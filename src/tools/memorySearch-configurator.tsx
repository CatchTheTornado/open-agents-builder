import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMemoryContext } from '@/contexts/memory-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Plus } from 'lucide-react';

/** The shape of the options this configurator manages. */
type MemoryStoreOptions = {
  storeName: string;
};

/** Props for the configurator component. */
type MemoryStoreConfiguratorProps = {
  /** Current options. */
  options: MemoryStoreOptions;
  /** Callback when the user changes anything. */
  onChange: (updated: MemoryStoreOptions) => void;
};

/**
 * A configurator for memory stores that allows the user to set or change the store name,
 * create new stores, or delete existing ones.
 */
export function MemorySearchConfigurator({
  options,
  onChange
}: MemoryStoreConfiguratorProps) {
  const { t } = useTranslation();
  const memoryContext = useMemoryContext();

  // Keep local pieces of state so our inputs are controlled.
  const [storeName, setStoreName] = useState(options.storeName);
  const [stores, setStores] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);

  // Load existing stores
  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await memoryContext.queryFiles({});
      if (response) {
        const storeNames = response.files.map(file => file.displayName || file.file.replace(/\.json$/, ''));
        setStores(storeNames);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStoreNameChange = (value: string) => {
    setStoreName(value);
    onChange({ ...options, storeName: value });
  };


  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      toast.error(t("Please enter a store name"));
      return;
    }

    setIsCreating(true);
    try {
      await memoryContext.createStore(newStoreName);
      await loadStores();
      handleStoreNameChange(newStoreName);
      setNewStoreName('');
      setShowCreateInput(false);
    } catch (error: any) {
      // Check if the error has a message property from the API response
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setIsCreating(false);
    }
  };


  return (
    <div className="space-y-4">
      {/* Store Selection or Creation */}
      <div className="space-y-2">
        <label className="block text-sm font-medium mb-1">
          {t('Select or Create Store')}
        </label>
        {!showCreateInput ? (
          <div className="flex gap-2">
            <Select
              value={storeName}
              onValueChange={handleStoreNameChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('Select store...')} />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store} value={store}>
                    {store}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowCreateInput(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('New Store')}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder={t('Enter store name...') || ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateStore();
                }
              }}
            />
            <Button
              onClick={handleCreateStore}
              disabled={isCreating}
            >
              {t('Create')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateInput(false);
                setNewStoreName('');
              }}
            >
              {t('Cancel')}
            </Button>
          </div>
        )}

      </div>

    </div>
  );
} 