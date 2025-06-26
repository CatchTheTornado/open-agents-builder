"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import React from "react";
import { DatabaseContext } from "@/contexts/db-context";
import { StatsContext } from "@/contexts/stats-context";
import { SaaSContext } from "@/contexts/saas-context";
// import { useAgentContext } from "@/contexts/agent-context";
import { AggregatedStatsDTO } from "@/data/dto";
import { DatabaseAuthStatus } from "@/data/client/models";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import DatabaseLinkAlert from "@/components/shared/database-link-alert";

ChartJS.register(ArcElement, Tooltip, Legend);

const pieChartOptions = {
  plugins: {
    legend: {
      position: "bottom" as const, // This moves labels to the bottom
      labels: {
        boxWidth: 15,
        padding: 10,
      },
    },
  },
};

function roundToTwoDigits(num: number): number {
  return Math.round(num * 100) / 100;
}

function calcAvailableBudget(saasContext: any) {
  return roundToTwoDigits(
    saasContext.currentQuota.allowedUSDBudget -
      saasContext.currentUsage.usedUSDBudget
  );
}

export default function StatsPage() {
  const dbContext = useContext(DatabaseContext);
  const statsContext = useContext(StatsContext);
  const saasContext = useContext(SaaSContext);
  // const agentContext = useAgentContext();
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStatsDTO>();
  const [availableBudget, setAvailableBudget] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    const loadStats = async () => {
      if (dbContext?.authStatus === DatabaseAuthStatus.Authorized) {
        try {
          await saasContext.loadSaaSContext("");
          if (saasContext.currentQuota) {
            setAvailableBudget(calcAvailableBudget(saasContext));
            setAggregatedStats(await statsContext.aggregatedStats());
          }
        } catch (e) {
          console.error(e);
          toast.error(t("Error while loading aggregated stats"));
        }
      }
    };
    loadStats();
  }, [saasContext.refreshDataSync]);

  const todayChart = useMemo(
    () => ({
      labels: ["Prompt Tokens", "Completion Tokens", "No. of Requests"],
      datasets: [
        {
          data: [
            aggregatedStats?.today?.promptTokens || 5,
            aggregatedStats?.today?.completionTokens || 5,
            aggregatedStats?.today?.requests || 5,
          ],
          backgroundColor: ["#4ade80", "#60a5fa", "#fbbf24", "#f87171"],
          hoverOffset: 6,
        },
      ],
    }),
    [aggregatedStats]
  );

  const monthChart = useMemo(
    () => ({
      labels: ["Prompt Tokens", "Completion Tokens", "No. of Requests"],
      datasets: [
        {
          data: [
            aggregatedStats?.thisMonth?.promptTokens || 1,
            aggregatedStats?.thisMonth?.completionTokens || 1,
            aggregatedStats?.thisMonth?.requests || 1,
          ],
          backgroundColor: ["#22d3ee", "#a78bfa", "#fb923c"],
          hoverOffset: 6,
        },
      ],
    }),
    [aggregatedStats]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">{t("Token Usage Dashboard")}</h1>
        <p className="text-muted-foreground">
          {t("Overview of your usage stats, budget, and quotas.")}
        </p>
      </div>

      {dbContext?.authStatus === DatabaseAuthStatus.Authorized &&
      aggregatedStats &&
      aggregatedStats.thisMonth &&
      aggregatedStats.today ? (
        <>
          {/* Summary Cards */}
          {!saasContext.userId && (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Available Budget</CardTitle>
                  {/* <CardDescription>
                    {t("Remaining monthly funds")}
                  </CardDescription> */}
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-xl font-bold ${availableBudget <= 0 ? "text-red-500" : ""}`}
                  >
                    {availableBudget}$ /{" "}
                    {saasContext.currentQuota.allowedUSDBudget}$
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Agents</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">
                    {saasContext.currentQuota.allowedAgents -
                      saasContext.currentUsage.usedAgents}{" "}
                    / {saasContext.currentQuota.allowedAgents}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">
                    {saasContext.currentQuota.allowedResults -
                      saasContext.currentUsage.usedResults}{" "}
                    / {saasContext.currentQuota.allowedResults}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">
                    {saasContext.currentQuota.allowedSessions -
                      saasContext.currentUsage.usedSessions}{" "}
                    / {saasContext.currentQuota.allowedSessions}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pie Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="p-6">
              <CardHeader>
                <CardTitle className="text-2xl">{t("Today's Usage")}</CardTitle>
              </CardHeader>
              <CardContent>
                <section className="space-y-2 mb-8">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span className="font-medium mr-2">
                      {t("prompt tokens")}
                    </span>
                    <span>
                      {aggregatedStats.today.promptTokens} {t("tokens")}
                    </span>

                    <span className="font-medium">
                      {t("completion tokens")}
                    </span>
                    <span>
                      {aggregatedStats.today.completionTokens} {t("tokens")}
                    </span>

                    <span className="font-medium">{t("no. of requests")}</span>
                    <span>{aggregatedStats.today.requests}</span>

                    <span className="font-medium border-t pt-2">
                      {t("overall usage")}
                    </span>
                    <span className="border-t pt-2">
                      {aggregatedStats.today.overallTokens} {t("tokens")} /{" "}
                      {aggregatedStats.today.overalUSD}$
                    </span>
                  </div>
                </section>
                <Pie data={todayChart} options={pieChartOptions} />
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader>
                <CardTitle className="text-2xl">{t("This Month's Usage")}</CardTitle>
              </CardHeader>
              <CardContent>
                <section className="space-y-2 mb-8 ">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span className="font-medium">{t("prompt tokens")}</span>
                    <span>
                      {aggregatedStats.thisMonth.promptTokens} {t("tokens")}
                    </span>

                    <span className="font-medium">
                      {t("completion tokens")}
                    </span>
                    <span>
                      {aggregatedStats.thisMonth.completionTokens} {t("tokens")}
                    </span>

                    <span className="font-medium">{t("no. of requests")}</span>
                    <span>{aggregatedStats.thisMonth.requests}</span>

                    <span className="font-medium border-t pt-2">
                      {t("overall usage")}
                    </span>
                    <span className="border-t pt-2">
                      {aggregatedStats.thisMonth.overallTokens} {t("tokens")} /{" "}
                      {aggregatedStats.thisMonth.overalUSD}$
                    </span>
                  </div>
                </section>
                <Pie data={monthChart} options={pieChartOptions} />
              </CardContent>
            </Card>
          </div>

          {/* Contact Link */}
          <div className="text-sm">
            <Link
              href="mailto:info@catchthetornado.com"
              className="underline text-blue-600 hover:text-blue-800"
            >
              {t("Contact us if you need more resources")}
            </Link>
          </div>
        </>
      ) : (
        <DatabaseLinkAlert />
      )}
    </main>
  );
}