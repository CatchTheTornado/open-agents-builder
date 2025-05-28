'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, FileText, Shield, BarChart, BookTemplateIcon, BookIcon, CogIcon, FunctionSquareIcon, MessageCircleMore, CalendarIcon, BoxesIcon, ListOrderedIcon, WebhookIcon, WorkflowIcon, NetworkIcon, VariableIcon, LucideProps, ZapIcon, FolderIcon, MemoryStick, TestTubeIcon, TestTubesIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAgentContext } from '@/contexts/agent-context';
import React, { ForwardRefExoticComponent, useEffect } from 'react';

const availableItems : {
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  label: string;
  href: string;
  pattern: string;
  agentTypes?: string[];
  activeOnlyOnSavedAgent?: boolean;
}[] = [
  { 
    icon: Settings2, 
    label: 'General', 
    href: '/admin/agent/[id]/general',
    pattern: '/admin/agent/[id]/general'
  },
  { 
    icon: FileText, 
    label: 'AI Prompt', 
    href: '/admin/agent/[id]/prompt',
    pattern: '/admin/agent/[id]/prompt',
    agentTypes: ['smart-assistant', 'survey-agent', 'commerce-agent']
  },
  {
    icon: FunctionSquareIcon,
    label: 'Events',
    href: '/admin/agent/[id]/events',
    pattern: '/admin/agent/[id]/events',
    agentTypes: ['smart-assistant', 'survey-agent', 'commerce-agent']
  },  
  // {  // inputs are now defined per flow
  //   icon: VariableIcon,
  //   label: 'Inputs',
  //   href: '/admin/agent/[id]/inputs',
  //   pattern: '/admin/agent/[id]/inputs',
  //   agentTypes: ['flow']
  // },  
  { 
    icon: WorkflowIcon,
    label: 'Sub-agents',
    href: '/admin/agent/[id]/agents',
    pattern: '/admin/agent/[id]/agents',
    agentTypes: ['flow']
  },  
  { 
    icon: NetworkIcon,
    label: 'Flows',
    href: '/admin/agent/[id]/flows',
    pattern: '/admin/agent/[id]/flows',
    agentTypes: ['flow']
  },
  { 
    icon: BookTemplateIcon, 
    label: 'Expected result', 
    href: '/admin/agent/[id]/expected-result',
    pattern: '/admin/agent/[id]/expected-result',
    agentTypes: ['smart-assistant', 'survey-agent', 'commerce-agent']
  },
  {
    icon: CogIcon,
    label: 'Tools',
    href: '/admin/agent/[id]/tools',
    pattern: '/admin/agent/[id]/tools',
    agentTypes: ['smart-assistant', 'survey-agent', 'commerce-agent']
  },
  { 
    icon: Shield, 
    label: 'Safety Rules', 
    href: '/admin/agent/[id]/safety',
    pattern: '/admin/agent/[id]/safety',
    agentTypes: ['smart-assistant', 'survey-agent', 'commerce-agent']
  },
  { 
    icon: MessageCircleMore, 
    label: 'Sessions', 
    href: '/admin/agent/[id]/sessions',
    pattern: '/admin/agent/[id]/sessions',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: BookIcon, 
    label: 'Results', 
    href: '/admin/agent/[id]/results',
    pattern: '/admin/agent/[id]/results',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: BoxesIcon, 
    label: 'Products and services', 
    href: '/admin/agent/[id]/products',
    pattern: '(.*)/products/(.*)',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: ListOrderedIcon, 
    label: 'Orders', 
    href: '/admin/agent/[id]/orders',
    pattern: '(.*)/orders/(.*)',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: CalendarIcon, 
    label: 'Calendar', 
    href: '/admin/agent/[id]/calendar',
    pattern: '/admin/agent/[id]/calendar',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: FolderIcon, 
    label: 'Attachments', 
    href: '/admin/agent/[id]/attachments',
    pattern: '/admin/agent/[id]/attachments',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: MemoryStick, 
    label: 'Memory and Knowledge', 
    href: '/admin/agent/[id]/memory',
    pattern: '/admin/agent/[id]/memory',
    activeOnlyOnSavedAgent: true
  },
  { 
    icon: WebhookIcon, 
    label: 'Integrations', 
    href: '/admin/agent/[id]/integrations',
    pattern: '/admin/agent/[id]/integrations',
    activeOnlyOnSavedAgent: false
  },
  { 
    icon: ZapIcon,
    label: 'Run & Share',
    href: '/admin/agent/[id]/exec',
    pattern: '/admin/agent/[id]/exec',
    agentTypes: ['flow']
  },
  { 
    icon: CogIcon, 
    label: 'API and widgets', 
    href: '/admin/agent/[id]/api',
    pattern: '/admin/agent/[id]/api',
    activeOnlyOnSavedAgent: false
  },  
  { 
    icon: TestTubesIcon,
    label: 'Evals',
    href: '/admin/agent/[id]/evals',
    pattern: '/admin/agent/[id]/evals',
    activeOnlyOnSavedAgent: true,
    agentTypes: ['smart-assistant', 'survey-agent', 'commerce-agent']
  },
];

export function AgentSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const params = useParams();
  const agentId = params?.id as string;
  const agentContext = useAgentContext();

  const [sidebarItems, setSidebarItems] = React.useState(availableItems);

  useEffect(() => {  
    setSidebarItems(availableItems.filter(item => !item.agentTypes || item.agentTypes?.includes((agentContext.dirtyAgent || agentContext.current)?.agentType || '')));
  }, [agentContext.dirtyAgent?.agentType, agentContext.current?.agentType]);

  return (
    <div className="flex w-64 flex-col border-r bg-card">
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {sidebarItems.map((item) => {
            const href = item.href.replace('[id]', agentId);
            const isActive = pathname.endsWith(href) || pathname.match(item.pattern)
            
            
            if ((item.activeOnlyOnSavedAgent && (!agentId || agentId === 'new')) && (!item.agentTypes || (item.agentTypes as Array<string>).includes(agentContext.dirtyAgent?.agentType || ''))) {
              return (
                <Button
                key={item.href}
                disabled={true}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >                
                <item.icon className="mr-2 h-5 w-5" />
                {t(item.label)}                
                </Button>
              )
            } else {
              return (
                <Link key={item.href} href={href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-2 h-5 w-5" />
                    {t(item.label)}
                  </Button>
                </Link>
              );
            }
           })
          }
        </div>
      </ScrollArea>
    </div>
  );
}