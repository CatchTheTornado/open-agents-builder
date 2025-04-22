'use client'
import { Button } from '@/components/ui/button';
import Link from "next/link";

import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import React, { useContext, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { KeyContext } from '@/contexts/key-context';
import { useAgentContext } from '@/contexts/agent-context';
import { DatabaseContext } from '@/contexts/db-context';
import { NoRecordsAlert } from '@/components/shared/no-records-alert';
import { DataLoadingStatus, KeyType } from '@/data/client/models';
import { CopyIcon, PlusIcon, BookIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCopyToClipboard } from 'react-use';
import { toast } from 'sonner';

import SyntaxHighlighter from 'react-syntax-highlighter';
import DataLoader from '@/components/data-loader';

export default function APIPage() {

  const { t } = useTranslation();
  const router = useRouter();
  const keysContext = useContext(KeyContext)
  const agentContext = useAgentContext();
  const dbContext = useContext(DatabaseContext);

  const [apiKey, setApiKey] = React.useState<string>('');
  const [, copy] = useCopyToClipboard();
  const [addKeyDialogOpen, setAddKeyDialogOpen] = React.useState(false);

  const snippet3 = dbContext?.databaseIdHash ? `export DATABASE_ID_HASH=${dbContext?.databaseIdHash}` : ``;

  const snippet0 = apiKey ? `export OPEN_AGENTS_BUILDER_API_KEY=${apiKey}` : `export OPEN_AGENTS_BUILDER_API_KEY=ad_key_****`;
  const snippet1 = `curl -X GET -H "Authorization: Bearer ${apiKey ? apiKey : '${OPEN_AGENTS_BUILDER_API_KEY}'}" \\
  -H "database-id-hash: ${dbContext?.databaseIdHash ?? ''}" \\
  ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/agent`;

  const snippet2 = `curl -X GET -H "Authorization: Bearer ${apiKey ? apiKey : '${OPEN_AGENTS_BUILDER_API_KEY}'}" \\
  -H "database-id-hash: ${dbContext?.databaseIdHash ?? ''}" \\
  ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/agent/\${AGENTID}/result`;


  const snippet4 = `
  <script src="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/chat-widget.js" data-chat-url="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/chat/${dbContext?.databaseIdHash ?? ''}/${agentContext?.current?.id}"></script>
  `;

  const snippet5 = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/chat/${dbContext?.databaseIdHash ?? ''}/${agentContext?.current?.id}`;

  useEffect(() => {
    keysContext.loadKeys();
  }, [apiKey]);

  return (
    <div className="space-y-6">


    {agentContext.current?.agentType !== 'flow' && (
      <Card>
        <CardContent className="p-4 space-y-6">
          <h3 className="text-sm font-bold">{t('Website widget')}</h3>

          <p className="text-sm">{t('Add the widget to your website to allow users to interact with your agent. Paste this HTML code before the closing ')} <code className="p-1 rounded-md">{t('</body>')}</code> {t('tag of your website:')}</p>

          <SyntaxHighlighter language="html" wrapLines={true}>
            {snippet4}
          </SyntaxHighlighter>
          <Button size={"sm"} variant={"ghost"} onClick={() => {
                  copy(snippet4);
                  toast.success(t('Widget HTML code has been copied to the clipboard'));
                }}><CopyIcon className="w-4 h-4 mr-2" /> {t('Copy snippet')}</Button>          
        </CardContent>
      </Card>
      )}


    {agentContext.current?.agentType !== 'flow' && (

      <Card>
        <CardContent className="p-4 space-y-6">
          <h3 className="text-sm font-bold">{t('Sharing link')}</h3>

          <p className="text-sm">{t('Share the link with your customers to allow them to interact with your agent. You can send it over email or put it on your website or social media.')}</p>

          <Input readOnly value={snippet5} />
          <Button size={"sm"} variant={"ghost"} onClick={() => {
                  copy(snippet5);
                  toast.success(t('The link has been copied to the clipboard'));
                }}><CopyIcon className="w-4 h-4 mr-2" /> {t('Copy link')}</Button>          
        </CardContent>
      </Card>
      )}


      <Card>
        <CardContent className="p-4 space-y-6">
          <h3 className="text-sm font-bold">{t('API Access')}</h3>
          <Dialog open={addKeyDialogOpen} onOpenChange={setAddKeyDialogOpen}>
            <DialogContent className="p-4">
              <h3 className="text-sm font-bold">{t('API Key has been added:')}</h3>
              <div className="flex">
                <Input readOnly value={apiKey} /> <Button variant="ghost" size={"sm"} onClick={() => {
                  copy(apiKey);
                  toast.success(t('Key has been copied to clipboard'));
                  keysContext.loadKeys();
                }}>
                  <CopyIcon className="w-4 h-4 mr-2" />
                </Button>
              </div>
              <p className="text-xs">
                <strong>{t('IMPORTANT: ')}</strong>{t('Please save this key. It will not be shown again. You can revoke it at any time.')}
              </p>
              <DialogFooter>
                <Button onClick={() => setAddKeyDialogOpen(false)}>{t('Close')}</Button>
              </DialogFooter>

            </DialogContent>
          </Dialog>

          <Button size={"sm"} className="" variant={"outline"} onClick={() => {

            keysContext.addApiKey().then((key) => {
              setApiKey(key);
              setAddKeyDialogOpen(true)
            }).catch((e) => {
              toast.error(t('Failed to add API key: ') + t(e.message));
            });
          }}>
            <PlusIcon className="w-4 h-4 mr-2" />{t('Add API key ...')}
          </Button>


          <Card>
            <CardContent className="p-4">
              {keysContext.loaderStatus === DataLoadingStatus.Loading && <div className="flex justify-center"><DataLoader /></div>}
              {keysContext.keys.filter(k => (k.extra !== null && k.extra.type === KeyType.API)).length === 0 && <NoRecordsAlert title={t('No API keys found')}>{t('Please add the first API key')}</NoRecordsAlert>}
              {keysContext.keys.filter(k => (k.extra !== null && k.extra.type === KeyType.API)).map((key) => (
                <div key={key.keyLocatorHash} className="flex justify-between items-center">
                  <div className="grid grid-cols-6 gap-4 w-full p-2">
                    <div className="font-bold col-span-3">{key.displayName}</div>
                    <div className="col-span-2 text-sm">{key.updatedAt}</div>
                    <div className="">
                      <Button variant={"secondary"} size={"sm"} onClick={() => {
                        keysContext.removeKey(key.keyLocatorHash);
                        toast.success(t('Key has been revoked'));
                      }}>{t('Revoke key')}</Button>

                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-sm">
              <p>
                {t('Your unique Database ID Hash is: ')}<strong>{dbContext?.databaseIdHash}</strong>
                <Button size={"sm"} variant={"ghost"} onClick={() => {
                  copy(dbContext?.databaseIdHash);
                  toast.success(t('Database ID Hash has been copied to clipboard'));
                }}><CopyIcon className="w-4 h-4 mr-2" /></Button>
              </p>
              <SyntaxHighlighter language="bash" wrapLines={true}>
                {snippet3}
              </SyntaxHighlighter>

            </CardContent>
          </Card>

          {keysContext.keys.filter(k => (k.extra !== null && k.extra.type === KeyType.API)).length > 0 && (
            <Card>
              <CardContent className="p-4 text-sm">
                <h3 className="font-bold text-sm mb-4">{t('API Access activated!')}</h3>

                <p>{t("That's great now you have API access to Open Agents Builder! Let's go start building!")}</p>

                <h4 className="mb-4 mt-4 font-bold text-sm ">{t('Read API docs and check the examples')}</h4>
                <p className="mb-4 items-center flex">{t('Full API Docs and some app examples are avaialable on our Github page: ')}
                  <Button className="ml-4 flex p-2">
                    <Link className="flex" href="https://docs.openagentsbuilder.com"><BookIcon className="w-4 h-4" /> {t('Go to the docs!')}</Link>
                  </Button>
                </p>

                <h4 className="mb-4 mt-4 font-bold">{t('Authorization and listing the agents ')}</h4>
                <p className="mb-4">{t('Save your API key for further usage. Note: this API Key is not saved by us. It is secret. After you reload this page it will disappear for good.')}</p>

                <SyntaxHighlighter language="bash" wrapLines={true}>
                  {snippet0}
                </SyntaxHighlighter>
                <Button size={"sm"} className="mt-4" variant={"outline"} onClick={() => {
                  copy(snippet0)
                }}><CopyIcon className="w-4 h-4 mr-2" />{t('Copy snippet')}</Button>

                <p className="mb-4 mt-4">{t('To get the list of your Agents using the API you can execute the following request:')}</p>

                <SyntaxHighlighter language="bash" wrapLines={true}>
                  {snippet1}
                </SyntaxHighlighter>
                <Button size={"sm"} className="mt-4" variant={"outline"} onClick={() => {
                  copy(snippet1)
                }}><CopyIcon className="w-4 h-4 mr-2" />{t('Copy snippet')}</Button>



                <h4 className="mb-4 mt-4 font-bold">{t('Listing agent results')}</h4>
                <p className="mb-4 mt-4">{t('To get the results of your agent execute the following request:')}</p>

                <SyntaxHighlighter language="bash" wrapLines={true}>
                  {snippet2}
                </SyntaxHighlighter>
                <p>{t('Where in the AGENTID is unique Agent ID taken from the agents list')}</p>

                <Button size={"sm"} className="mt-4" variant={"outline"} onClick={() => {
                  copy(snippet2)
                }}><CopyIcon className="w-4 h-4 mr-2" />{t('Copy snippet')}</Button>

                <p className="mt-4">
                  <strong>{t('Note: ')}</strong>{t('Please make sure you replaced the "ad_key_****" with your copied API key.')}
                </p>

                <p className="mt-4">{t('For more API endpoints including: Calendar, Orders, Products, Sessions, AI Chat.')} <a className="text-blue-600 underline" href="">{t('Check our docs')}</a></p>

              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}