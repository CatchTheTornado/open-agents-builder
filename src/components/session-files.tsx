import { useAgentContext } from "@/contexts/agent-context";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";
import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileIcon, DownloadIcon } from "lucide-react";
import { Button } from "./ui/button";
import DataLoader from "./data-loader";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export enum SessionFilesDisplayMode {
  icon = "icon",
  list = "list",
}

interface SessionFilesProps {
  sessionId: string;
  displayMode?: SessionFilesDisplayMode;
}

export function SessionFiles({
  sessionId,
  displayMode = SessionFilesDisplayMode.icon,
}: SessionFilesProps) {
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext); // reserved for future use (headers)
  const { t } = useTranslation();

  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!sessionId || !dbContext?.databaseIdHash) return;
    setLoading(true);

    const url = `/storage/session/${dbContext.databaseIdHash}/${sessionId}/files`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: string[]) => {
        setFiles(data);
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("Failed to fetch session files"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId, dbContext?.databaseIdHash]);

  if (loading) {
    return <DataLoader />;
  }

  if (!files || files.length === 0) {
    return null;
  }

  const fileUrl = (fileName: string) =>
    `/storage/session/${dbContext?.databaseIdHash}/${sessionId}/file?name=${encodeURIComponent(
      fileName
    )}`;

  return (
    <div className="flex space-2 mt-2 flex-wrap gap-2">
      {files.map((file) =>
        displayMode === SessionFilesDisplayMode.icon ? (
          <a
            href={fileUrl(file)}
            target="_blank"
            rel="noopener noreferrer"
            key={file}
          >
            <Button variant="outline" size="sm" className="flex gap-2 items-center">
              <FileIcon className="w-4 h-4" /> {file}
            </Button>
          </a>
        ) : (
          <div key={file} className="flex items-center gap-2">
            <FileIcon className="w-4 h-4" />
            <Link
              className="underline text-primary"
              href={fileUrl(file)}
              target="_blank"
            >
              {file}
            </Link>
            <a href={fileUrl(file)} target="_blank" rel="noopener noreferrer">
              <DownloadIcon className="w-4 h-4" />
            </a>
          </div>
        )
      )}
    </div>
  );
} 