import { Home, BookOpen, Hand, ClipboardCheck, MessageSquare, TrendingUp, CreditCard, LifeBuoy, Award, FileText, Sparkles } from 'lucide-react';
import { Shell, type NavItem } from './Shell';

const items: NavItem[] = [
  { label: 'Home', to: '/app', icon: Home, end: true, primary: true },
  { label: 'My Course', to: '/app/course', icon: BookOpen, primary: true },
  { label: 'Practice', to: '/app/practice', icon: Hand, primary: true },
  { label: 'Assessments', to: '/app/assessments', icon: ClipboardCheck },
  { label: 'Exams', to: '/app/exams', icon: FileText },
  { label: 'Discussion', to: '/app/discussions', icon: MessageSquare },
  { label: 'Progress', to: '/app/progress', icon: TrendingUp, primary: true },
  { label: 'Payments', to: '/app/payments', icon: CreditCard },
  { label: 'Certificate', to: '/app/certificate', icon: Award },
  { label: 'AI features', to: '/app/ai', icon: Sparkles },
  { label: 'Help', to: '/app/help', icon: LifeBuoy },
];

export default function AppLayout() {
  return <Shell items={items} areaLabel="Student" areaTone="student" basePath="/app" />;
}
