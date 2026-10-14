import { createFileRoute } from '@tanstack/react-router';
import { ArrowDown, ArrowRight, Heart, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brand, PhoneShowcase } from '@/components/renomedy-phones';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Renomedy — Medicine routines, made easier to share' },
    { name: 'description', content: 'A more connected approach to family medicine routines. Discover Renomedy, an app in development for aging parents, adult children, and family caregivers.' },
    { property: 'og:title', content: 'Renomedy — Medicine routines, made easier to share' },
    { property: 'og:description', content: 'A shared routine. A little more together. Explore the Renomedy app concept and early-access plans.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});
const steps = [
  { title: 'Bring the routine together', description: 'A clear place for medicine names, routine times, and the small details that are easy to forget.' },
  { title: 'Make room for family', description: 'A shared view for the people involved, so coordinating care doesn’t have to mean another group chat.' },
  { title: 'Take it one day at a time', description: 'Today’s routine, useful reminders, and family updates — designed to make everyday coordination feel lighter.' },
];
function Index() {
  const [accessOpen, setAccessOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!accessOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccessOpen(false);
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = original; document.removeEventListener('keydown', onKey); triggerRef.current?.focus(); };
  }, [accessOpen]);
  return <main id="top">
    <div className="hero-band">
      <header className="site-header container"><Brand linked /><nav className="nav-links" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#for-families">For families</a><a href="#our-approach">Our approach</a><Button asChild className="hero-cta nav-cta"><a href="#early-access">Explore early access <ArrowRight /></a></Button></nav></header>
      <section className="hero-content container" aria-labelledby="hero-heading"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" />A little clarity. A little more together.</div><h1 id="hero-heading">Medicine routines,<br />made easier<br /><em>to share.</em></h1><p className="hero-description">For the parents you love, and the family that cares. A calmer way to keep medicine routines clear, connected, and part of everyday life.</p><div className="hero-actions"><Button asChild className="hero-cta"><a href="#early-access">Explore early access <ArrowRight /></a></Button><a href="#how-it-works" className="text-link">See how it works <ArrowDown /></a></div><p className="hero-footnote">Thoughtfully in development. Not yet available.</p><div className="people-proof"><p><strong>For real families. For everyday care.</strong><br />Parents, adult children, and the people who help.</p></div></div><PhoneShowcase /></section>
    </div>
    <div className="intro-band container"><div className="intro-inner"><span className="eyebrow">An everyday kind of care</span><p>Care is a team effort.<span>The everyday details should be easier to share.</span></p></div></div>
    <section className="section container workflow-section" id="how-it-works"><div className="section-heading"><div className="eyebrow">A simpler shared routine</div><h2>A few small steps.<br />A more connected day.</h2><p>Here’s the experience we’re building — with family life in mind.</p></div><div className="workflow-grid">{steps.map(({ title, description }, i) => <article className="workflow-step" key={title}><div className="step-top"><span className="step-number">0{i + 1}</span><span className="step-line" /></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="section family-section" id="for-families"><div className="container family-layout"><div className="family-copy"><div className="eyebrow">For the people who care</div><h2>You don’t have to be<br />in the same room<br />to be on the same page.</h2><p>Between work, distance, and the rest of life, keeping up with a parent’s routine can feel like a lot. We’re designing Renomedy to make those everyday handovers a little easier.</p><div className="benefit-list"><div className="benefit"><div><h3>A shared picture, not scattered messages</h3><p>Medicine routines and family notes, together in one place.</p></div></div><div className="benefit"><div><h3>Support that feels like family</h3><p>Designed around helping, not taking over.</p></div></div><div className="benefit"><div><h3>More clarity for the little handovers</h3><p>Know what’s been shared and who’s planning to help.</p></div></div></div></div><div><div className="coordination-card"><div className="coordination-header"><div><h3>Mum’s care circle</h3><p>Different people. One shared routine.</p></div><span className="family-badge"><Users />Family</span></div>{[['M','Margaret','Keeping her own routine','Mum'],['E','Emma','Checking in from a little further away','Daughter'],['J','James','Helping with the everyday details','Son']].map(([initial,name,description,role], i) => <div className="coordination-row" key={name}><span className={`person-avatar ${i === 2 ? 'warm' : ''}`}>{initial}</span><div><strong>{name}</strong><p>{description}</p></div><span className="role-badge">{role}</span></div>)}<div className="coordination-note">“I’ll be over after work. I can help get everything ready for tomorrow.”<small>James · A note for the family</small></div></div><p className="concept-note">An example of the family experience we’re working toward.</p></div></div><div className="container approach-layout" id="our-approach"><div className="section-heading"><div className="eyebrow">Thoughtful by intention</div><h2>Real care deserves<br />an honest approach.</h2><p>We’re building carefully, and we want to be clear about what Renomedy is — and what it isn’t.</p></div><div className="trust-grid"><article className="trust-item"><h3>People before complexity</h3><p>Clear language, readable routines, and a considered experience for parents and family caregivers are at the heart of our design.</p></article><article className="trust-item"><h3>A companion, not medical advice</h3><p>Renomedy is being designed for routine coordination. Medicine decisions and instructions belong with your healthcare professional.</p></article><article className="trust-item"><h3>Built with room to listen</h3><p>This is an early product concept. The screens show our direction, not a live service. Features and availability may change as development progresses.</p></article></div></div></section>
    <section className="early-access" id="early-access"><div className="container early-inner"><div className="early-copy"><div className="eyebrow"><span className="status-dot" />In development · Made with care</div><h2>A calmer routine starts<br />with a little connection.</h2><p>We’re working toward an early version of Renomedy for families. Early access isn’t open yet, and we haven’t set a launch date. We’ll share more when we’re ready.</p></div><div className="early-action"><Button ref={triggerRef} onClick={() => setAccessOpen(true)} className="hero-cta">View early-access plans <ArrowRight /></Button><p>No signup or commitment required.</p></div></div></section>
    <footer className="site-footer container"><Brand linked /><p>A shared routine. A little more together.</p><p>© 2026 Renomedy · In development</p></footer>
    {accessOpen && <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setAccessOpen(false); }}><div className="access-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="access-title" aria-describedby="access-description"><Button variant="ghost" size="icon" className="dialog-close" aria-label="Close early-access plans" onClick={() => setAccessOpen(false)}><X /></Button><div className="eyebrow">The next chapter</div><h2 id="access-title">Early days.<br />Thoughtful beginnings.</h2><p id="access-description">Renomedy is still in development. Our next step is to refine the family experience before making an early version available.</p><ul><li>Medicine schedules and routine details</li><li>Reminders designed for everyday life</li><li>A shared view for family coordination</li></ul><p>These are planned capabilities, not live features. There’s no confirmed launch date or open waitlist, and this page doesn’t collect your information.</p><Button className="hero-cta mt-6" onClick={() => setAccessOpen(false)}>Looking forward to it <Heart /></Button></div></div>}
  </main>;
}