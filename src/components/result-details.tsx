import type { FC } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail } from "lucide-react"
import { useTranslation } from "react-i18next"

export interface ResultDetailsProps {
  sessionStart: Date
  sessionEnd: Date
  userName: string
  userEmail: string
  messageCount: number
  inputTokens: number
  outputTokens: number
}

const ResultDetails: FC<ResultDetailsProps> = ({
  sessionStart,
  sessionEnd,
  userName,
  userEmail,
  messageCount,
  inputTokens,
  outputTokens,
}) => {
  const duration = sessionEnd.getTime() - sessionStart.getTime()
  const durationInMinutes = Math.round(duration / 60000)

  const { t } = useTranslation()

  const formatDate = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">{userName}</h2>
            <a href={`mailto:${userEmail}`} className="text-primary hover:underline flex items-center">
              <Mail className="w-4 h-4 mr-1" />
              {userEmail}
            </a>
          </div>

          <div>
            {t('Started')}: <span className="font-medium">{formatDate(sessionStart)}</span>
          </div>
          <div>
            {t('Ended')}: <span className="font-medium">{formatDate(sessionEnd)}</span>
          </div>

          <div>
            {t('Duration')}: <span className="font-medium">{durationInMinutes} {t('min')}</span>
          </div>
          <div>
            {t('Messages')}: <span className="font-medium">{messageCount}</span>
          </div>

          <div className="col-span-2 flex justify-between items-center mt-2">
            <Badge variant="outline" className="text-primary">
              {t('Input Tokens')}: {inputTokens}
            </Badge>
            <Badge variant="outline" className="text-primary">
              {t('Output Tokens')}: {outputTokens}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ResultDetails

