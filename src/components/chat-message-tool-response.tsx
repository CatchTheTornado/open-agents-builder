import { useTranslation } from "react-i18next";
import { Credenza, CredenzaContent, CredenzaFooter, CredenzaTrigger } from "./credenza";
import JsonView from "@uiw/react-json-view";
import { ScrollArea } from "./ui/scroll-area";
import { CodeIcon, CopyIcon, SaveIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { githubLightTheme } from '@uiw/react-json-view/githubLight';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";

export function ChatMessageToolResponse( { args, result }: { args?: any, result: any}) {
    const { t } = useTranslation();
    const { theme, systemTheme } = useTheme();
    const currentTheme = (theme === 'system' ? systemTheme : theme)

    const [, copy] = useCopyToClipboard();
    
    return (
        <Credenza >
            <CredenzaTrigger asChild>
                <Button className="ml-auto right-20 m-2" size={"sm"} variant="secondary">
                    <CodeIcon className="w-4 h-4" />{t('Open details')}
                </Button>
            </CredenzaTrigger>
            <CredenzaContent className="w-full">
                {t('Arguments')}:
                <ScrollArea className="h-32">
                   <JsonView style={currentTheme === 'dark' ? githubDarkTheme : githubLightTheme } value={args} />
                </ScrollArea>

                {t('Result')}:
                <ScrollArea className="h-96">
                   <JsonView style={currentTheme === 'dark' ? githubDarkTheme : githubLightTheme } value={result} />
                </ScrollArea>
                <div className="flex">
                    <Button size={"sm"} variant={"ghost"} onClick={() => {
                        copy(JSON.stringify(result));
                        toast.success(t('Result copied to clipboard'));
                    }}><CopyIcon /></Button>
                    <Button size={"sm"} variant={"ghost"} onClick={() => {
                        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'result.json';
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success(t('File downloaded successfully'));
                    }
                    }><SaveIcon /></Button>
                </div>
            </CredenzaContent>
        </Credenza>
    )    
}