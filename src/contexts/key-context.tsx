'use client';

import { DataLoadingStatus, Key, KeyExtra, KeyType } from '@/data/client/models';
import { EncryptionUtils, generatePassword, sha256 } from '@/lib/crypto';
import React, { createContext, PropsWithChildren, useContext, useState } from 'react';
import { DatabaseContext, defaultDatabaseIdHashSalt, defaultKeyLocatorHashSalt } from './db-context';
import { toast } from 'sonner';
import { KeyACLDTO, KeyDTO } from '@/data/dto';
import { KeyApiClient, PutKeyResponse, PutKeyResponseError } from '@/data/client/key-api-client';
import { ConfigContextType } from '@/contexts/config-context';
import { getCurrentTS } from '@/lib/utils';
import assert from 'assert';
import {  SaaSContextType } from './saas-context';
import { useTranslation } from 'react-i18next';
import { SignJWT } from 'jose';
const argon2 = require("argon2-browser");

interface KeyContextProps {
    keys: Key[];
    loaderStatus: DataLoadingStatus;
    sharedKeysDialogOpen: boolean;
    changePasswordDialogOpen: boolean;
    currentKey: Key | null;

    loadKeys: () => void;
    addKey: (email: string, displayName: string, sharedKey: string, expDate: Date | null, acl: KeyACLDTO, extra: KeyExtra) => Promise<PutKeyResponse>;
    addApiKey: () => Promise<string>;
    removeKey: (keyLocatorHash: string) => Promise<PutKeyResponse>;
    removeKeyByName: (displayName: string) => Promise<PutKeyResponse | null>;

    setCurrentKey: (key: Key | null) => void;
    setSharedKeysDialogOpen: (value: boolean) => void;
    setChangePasswordDialogOpen: (value: boolean) => void;
}

export const KeyContext = createContext<KeyContextProps>({
    keys: [],
    loaderStatus: DataLoadingStatus.Idle,
    sharedKeysDialogOpen: false,
    changePasswordDialogOpen: false,
    currentKey: null,
    
    loadKeys: () => {},
    addKey: (email: string, displayName: string, sharedKey: string, expDate: Date | null, acl: KeyACLDTO) => Promise.resolve({} as PutKeyResponse),
    addApiKey: () => Promise.resolve(''),
    removeKey: (keyLocatorHash: string) => Promise.resolve({} as PutKeyResponse),
    removeKeyByName: (displayName: string) => Promise.resolve(null),

    setCurrentKey: (key: Key | null)  => {},
    setSharedKeysDialogOpen: () => {},
    setChangePasswordDialogOpen: () => {},
    
});

export const KeyContextProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [keys, setKeys] = useState<Key[]>([]);
    const [loaderStatus, setLoaderStatus] = useState<DataLoadingStatus>(DataLoadingStatus.Idle);
    const [sharedKeysDialogOpen, setSharedKeysDialogOpen] = useState(false);
    const [currentKey, setCurrentKey] = useState<Key | null>(null);
    const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
    const dbContext = useContext(DatabaseContext);
    const { t } = useTranslation();

    const setupApiClient = async (config: ConfigContextType | null, saasContext?: SaaSContextType | null) => {
        const client = new KeyApiClient('', dbContext, saasContext);
        return client;
    }

    const addApiKey = async (): Promise<string> => {
        const keyNumber = keys.filter(k => k.extra?.type === KeyType.API).length + 1;
        const response = await addKey(dbContext?.email || '', 'ad_key_*******_' + keyNumber , generatePassword(), null, { role: 'guest', features: ['*'] }, { type: KeyType.API });

        let newKey;
        if (response.status === 200) {
            newKey = response.data
        } else {
            throw new Error(response.message);
        }

        const alg = 'HS256'
        const tokenPayload = { databaseIdHash: newKey.databaseIdHash, keyHash: newKey.keyHash, keyLocatorHash: newKey.keyLocatorHash }
        const accessToken = await new SignJWT(tokenPayload)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setIssuer('urn:ctt:open-agents-builder')
        .setAudience('urn:ctt:open-agents-builder')
//        .setExpirationTime('15m') // offline token - no expiration date
        .sign(new TextEncoder().encode(process.env.NEXT_PUBLIC_TOKEN_SECRET || 'Jeipho7ahchue4ahhohsoo3jahmui6Ap'))

        return 'ad_key_' + accessToken; // we are not saving this key in the database

    }

    const addKey = async (email: string, displayName: string, sharedKey: string, expDate: Date | null, acl: KeyACLDTO = {
        role: 'guest',
        features: ['*']
    }, extra = {
        type: KeyType.User
    } ): Promise<PutKeyResponse> => {
        // setKeys((prevKeys) => [...prevKeys, newKey]);
        const keyHashParams = {
            salt: generatePassword(),
            time: 2,
            mem: 16 * 1024,
            hashLen: 32,
            parallelism: 1
        } 
        const keyHash = await argon2.hash({
          pass: sharedKey,
          salt: keyHashParams.salt,
          time: keyHashParams.time,
          mem: keyHashParams.mem,
          hashLen: keyHashParams.hashLen,
          parallelism: keyHashParams.parallelism
        });
        const databaseIdHash = await sha256(email, defaultDatabaseIdHashSalt);
        const keyLocatorHash = await sha256(sharedKey + email, defaultKeyLocatorHashSalt);

        const existingKey = keys.find((key) => key.keyLocatorHash === keyLocatorHash);
        if (existingKey) {
            
            toast.error(t('Key already exists, please choose a different key!'));
            throw new Error(t('Key already exists'));
        }

        const encryptionUtils = new EncryptionUtils(sharedKey);
        const masterKey = await dbContext?.masterKey;
        assert(masterKey, 'Master key is not set');
        const encryptedMasterKey = await encryptionUtils.encrypt(masterKey);
        
        const apiClient = await setupApiClient(null);
        const keyDTO: KeyDTO = {
            databaseIdHash,
            encryptedMasterKey,
            keyHash: keyHash.encoded,
            keyHashParams: JSON.stringify(keyHashParams),
            keyLocatorHash,
            displayName,
            extra: JSON.stringify(extra),
            acl: JSON.stringify(acl),
            expiryDate: expDate !== null ? expDate.toISOString() : '',
            updatedAt: getCurrentTS()
        };

        const result = await apiClient.put(keyDTO);
        
        if(result.status === 200) {
            toast(t('Authorization Key succesfull added.'))
        } else {
            toast.error(t((result as PutKeyResponseError).message));
        }

        return result;

    };

    const removeKeyByName = async (displayName: string) => {
        const key = keys.find((key) => key.displayName === displayName);
        if (key) {
            setKeys((prevKeys) => prevKeys.filter((key) => key.displayName !== displayName));
            const apiClient = await setupApiClient(null);
            return apiClient.delete(key.keyLocatorHash);
        }
        return null;
    };    

    const removeKey = async (keyLocatorHash: string) => {
        setKeys((prevKeys) => prevKeys.filter((key) => key.keyLocatorHash !== keyLocatorHash));
        const apiClient = await setupApiClient(null);
        return apiClient.delete(keyLocatorHash);
    };

    const loadKeys = async () => {
        const apiClient = await setupApiClient(null);
        const keys = await apiClient.get();
        setKeys(keys.filter(k => k.displayName && (k.acl && (JSON.parse(k.acl) as KeyACLDTO).role !== 'owner') ).map(k=>new Key(k))); // skip keys without display name
    }

    return (
        <KeyContext.Provider value={{ keys, loaderStatus, currentKey, changePasswordDialogOpen, sharedKeysDialogOpen, addKey, removeKey, loadKeys, setSharedKeysDialogOpen, setChangePasswordDialogOpen, setCurrentKey, addApiKey, removeKeyByName }}>
            {children}
        </KeyContext.Provider>
    );
}

export function useKeyContext() {
    const context = useContext(KeyContext);
    if (!context) {
        throw new Error('useKeyContext must be used within a KeyProvider');
    }
    return context;
}