import { useState } from 'react';
import { cn } from '@/lib/utils';
import ZoomableImage from './zoomable-image';

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

  return (
    <div className={cn('flex flex-wrap gap-2 mt-2', className)}>
      {attachments
        ?.filter(attachment => attachment.contentType?.startsWith('image/'))
        .map((attachment, index) => (
          <div key={`${attachment.url}-${index}`} className="relative group">
            {!errorImages.has(attachment.url) ? (
              <ZoomableImage
                src={attachment.url}
                alt={attachment.name || 'Image attachment'}
                className="max-h-48 rounded-lg object-cover hover:opacity-90 transition-opacity"
                onError={() => handleImageError(attachment.url)}
              />
            ) : (
              <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Failed to load image</span>
              </div>
            )}
            {attachment.name && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                {attachment.name}
              </div>
            )}
          </div>
        ))}
    </div>
  );
} 