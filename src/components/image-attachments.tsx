import { useState } from 'react';
import { cn } from '@/lib/utils';
import ZoomableImage from './zoomable-image';
import { DownloadIcon, FileIcon } from 'lucide-react';
import { Button } from './ui/button';

interface ImageAttachment {
  url: string;
  name?: string;
  contentType?: string;
}

interface ImageAttachmentsProps {
  attachments: ImageAttachment[];
  className?: string;
}

export function ImageAttachments({ attachments, className }: ImageAttachmentsProps) {
  const [errorImages, setErrorImages] = useState<Set<string>>(new Set());

  const handleImageError = (url: string) => {
    setErrorImages(prev => new Set(prev).add(url));
  };

  const handleDownload = (url: string, name?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name || 'download';
    link.click();
  };

  return (
    <div className={cn('flex flex-wrap gap-2 mt-2', className)}>
      {attachments.map((attachment, index) => {
        const isImage = attachment.contentType?.startsWith('image/');
        return (
            <div key={`${attachment.url}-${index}`} className="relative group">
            {isImage && !errorImages.has(attachment.url) ? (
              <ZoomableImage
              src={attachment.url}
              alt={attachment.name || 'Image attachment'}
              className="max-h-48 rounded-lg object-cover hover:opacity-90 transition-opacity"
              onError={() => handleImageError(attachment.url)}
              />
            ) : isImage ? (
              <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Failed to load image</span>
              </div>
            ) : (
              <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center">
              <FileIcon className="w-8 h-8 text-muted-foreground" />
              <Button
                variant="ghost"
                onClick={() => handleDownload(attachment.url, attachment.name)}
                className="absolute bottom-2 right-2 bg-primary  p-1 rounded hover:bg-primary-dark transition"
              >
                <DownloadIcon className="w-4 h-4" />
              </Button>
              </div>
            )}
            {attachment.name && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {attachment.name}
              </div>
            )}
            </div>
        );
      })}
    </div>
  );
}