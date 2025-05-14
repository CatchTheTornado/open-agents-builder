import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from './chat.module.css';
import ZoomableImage from "./zoomable-image";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "react-use";
import { CopyIcon, SaveIcon } from "lucide-react";
import { Button } from "./ui/button";

export function ChatMessageMarkdown({ children, className = '', copyToCC = true }) {

    const [, copy] = useCopyToClipboard();

    return (<div>
        <Markdown className={cn(styles.markdown, className)} remarkPlugins={[remarkGfm]} components={
            {
                a(props) {
                    if (props.href) {
                        return <a {...props} />
                    } else {
                        return <span {...props} />
                    }
                },
                img(props) {
//                    if (props.alt?.startsWith('product')) {
                        return <ZoomableImage src={props.src} width={100} height={100} className="border" />
  //                  } else {
  //                      return <img {...props} />
//                 }
                }
            }
        }>
            {children}
        </Markdown>
        { copyToCC && <Button variant="ghost" onClick={() => copy(children)} className="text-xs m-2"><CopyIcon /></Button>}
        { copyToCC && <Button variant="ghost" onClick={() =>{
            const blob = new Blob([children], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'message.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }} className="text-xs m-2"><SaveIcon /></Button>}
        </div>
    )
}
