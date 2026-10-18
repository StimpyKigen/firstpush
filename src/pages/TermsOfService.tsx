import { motion } from 'motion/react';
import { ShieldCheck, Scale, AlertTriangle, UserX, Award, FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import BackNavButton from '../components/BackNavButton';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <SeoHead
        title="Terms of Service"
        description="MshindiRoom Terms of Service: Read our terms, community guidelines, non-gambling platform notice, and user responsibilities."
        canonicalUrl="https://mshindi.co.ke/terms"
      />
      <div className="mb-6">
        <BackNavButton fallbackUrl="/" label="Back" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-semibold mb-3">
            <Scale size={14} />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-cream tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-cream-dim">
            Last Updated: August 5, 2026 • Effective Date: Immediate
          </p>
        </div>

        {/* Essential Notice Box */}
        <div className="bg-[#8A6500]/10 border border-[#8A6500]/25 rounded-2xl p-5 sm:p-6 text-cream text-sm leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-display font-bold text-[#8A6500] text-base">
            <AlertTriangle size={18} />
            IMPORTANT NOTICE — NOT A BOOKMAKER / BETTING OPERATOR
          </div>
          <p className="text-cream-dim text-xs sm:text-sm">
            MshindiRoom is a sports analytics, punter discussion, bet slip code parsing, and prediction tracking community platform. <strong className="text-cream">We do NOT accept real-money bets, host gambling operations, or act as a licensed bookmaker.</strong> Platform tokens, Rating Points (RP), star levels, and M-Pesa deposit top-ups are strictly internal virtual utilities for accessing premium analytical tools, community rooms, and leaderboards. Tokens carry no cash withdrawal value and cannot be redeemed for fiat currency.
          </p>
        </div>

        {/* Terms Sections */}
        <div className="space-y-8 text-cream-dim text-sm leading-relaxed">
          {/* Section 1 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <CheckCircle2 className="text-gold shrink-0" size={20} />
              <h2>1. Acceptance of Terms & Eligibility</h2>
            </div>
            <p>
              By accessing or using MshindiRoom, you agree to be bound by these Terms of Service. If you do not agree to all terms, you must not use the service.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>You must be at least <strong className="text-cream">18 years of age</strong> (or the legal age of majority in your jurisdiction) to create an account.</li>
              <li>You are responsible for maintaining the confidentiality of your credentials (phone number and 4-digit PIN).</li>
              <li>Each individual is limited to maintaining one (1) active user account verified by phone number.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <ShieldCheck className="text-gold shrink-0" size={20} />
              <h2>2. Community Guidelines & Content Moderation</h2>
            </div>
            <p>
              To maintain a safe, respectful environment for all punters, users agree NOT to:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Post hate speech, personal attacks, harassment, profanity, or discriminatory content.</li>
              <li>Post unauthorized phone numbers, personal contacts, or private commercial advertisements ("scam fixed matches").</li>
              <li>Attempt to manipulate prediction statistics, exploit rating system algorithms, or utilize automated scripts/bots.</li>
              <li>Impersonate other punters, verified analysts, or MshindiRoom moderators.</li>
            </ul>
            <p className="text-xs text-[#8A6500] font-medium pt-1">
              Violations are reviewed by our automated AI moderation filter and community team. Accounts found violating community guidelines are subject to warnings, temporary mutes, or permanent ban.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <Award className="text-gold shrink-0" size={20} />
              <h2>3. Wallet Tokens, Rating Points (RP) & Bet Slip Tools</h2>
            </div>
            <p>
              MshindiRoom calculates Rating Points (RP) and star tiers based on match prediction accuracy, while wallet tokens allow access to community features.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Tokens and Rating Points carry no inherent monetary cash-out value.</li>
              <li>Bet slip parsing for bookies (e.g., SportPesa, Betika, Mozzart, 22Bet, Odibets) is provided for community analytical convenience only. MshindiRoom does not guarantee third-party bookie code validation or odds accuracy.</li>
              <li>Special promotional contests or leaderboards offered on the platform are subject to explicit contest rules published at the time of event start.</li>
              <li>MshindiRoom reserves the right to recalculate or adjust RP in cases of match cancellations, feed errors, or anti-cheat enforcement.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <AlertTriangle className="text-gold shrink-0" size={20} />
              <h2>4. Disclaimer of Warranties & Sports Data</h2>
            </div>
            <p>
              Sports fixtures, kick-off times, live scores, team data, and third-party odds are provided for informational and discussion purposes only.
            </p>
            <p>
              While we strive to ensure high data accuracy, MshindiRoom makes no warranties regarding the timeliness, completeness, or guaranteed accuracy of third-party sports feeds or community predictions. Users act upon predictions at their own risk.
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <UserX className="text-gold shrink-0" size={20} />
              <h2>5. Account Suspension & Termination</h2>
            </div>
            <p>
              MshindiRoom reserves the right to suspend or terminate any user account at any time without prior notice if we determine in good faith that the user has violated these Terms of Service or engaged in behavior harmful to the community.
            </p>
          </section>

          {/* Section 6 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <FileText className="text-gold shrink-0" size={20} />
              <h2>6. Changes to Terms & Contact</h2>
            </div>
            <p>
              We reserve the right to modify these Terms of Service at any time. Continued use of the service following modifications constitutes acceptance of the revised terms.
            </p>
            <p>
              If you have any questions regarding these Terms, please contact us at <a href="mailto:support@mshindiroom.com" className="text-gold hover:underline font-mono">support@mshindiroom.com</a> or read our <Link to="/privacy" className="text-gold hover:underline font-semibold">Privacy Policy</Link>.
            </p>
          </section>
        </div>

        {/* Footer Link */}
        <div className="border-t border-line pt-6 flex justify-between items-center text-xs text-cream-dim">
          <Link to="/privacy" className="text-gold hover:underline font-semibold">Read Privacy Policy &rarr;</Link>
          <Link to="/" className="text-cream-dim hover:text-cream">&larr; Back to Home</Link>
        </div>
      </motion.div>
    </div>
  );
}
