import { motion } from 'motion/react';
import { Shield, Lock, Eye, Database, UserCheck, Bell, Mail, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <SeoHead
        title="Privacy Policy"
        description="MshindiRoom Privacy Policy: Learn how we protect user data, respect privacy rights, and ensure transparent community guidelines."
        canonicalUrl="https://mshindi.co.ke/privacy"
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-semibold mb-3">
            <Shield size={14} />
            <span>Legal & Privacy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-cream tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-cream-dim">
            Last Updated: August 5, 2026 • Effective Date: Immediate
          </p>
        </div>

        {/* Intro Banner */}
        <div className="bg-panel/80 border border-line rounded-2xl p-5 sm:p-6 text-cream-dim text-sm leading-relaxed space-y-3">
          <p>
            At <strong className="text-cream font-semibold">MshindiRoom</strong>, accessible from our mobile app and website, protecting the privacy and security of our community members is a top priority.
          </p>
          <p>
            This Privacy Policy document details the types of personal information collected and recorded by MshindiRoom, how we use it, and your rights regarding your data.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8 text-cream-dim text-sm leading-relaxed">
          {/* Section 1 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <Lock className="text-gold shrink-0" size={20} />
              <h2>1. Information We Collect</h2>
            </div>
            <p>
              When you register for an account, participate in prediction rooms, or interact with our platform, we collect the following categories of information:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-cream">Account Credentials:</strong> Your phone number, chosen username, secret 4-digit PIN hash, and selected avatar identifier.</li>
              <li><strong className="text-cream">User Activity & Predictions:</strong> Sports prediction picks, bookie bet slip codes, parsed multi-leg slips, consensus votes, room comments, and community discussion messages.</li>
              <li><strong className="text-cream">M-Pesa Verification Data:</strong> M-Pesa transaction codes submitted for automated token wallet top-ups. We store transaction reference IDs to verify receipts; we never request or store M-Pesa PINs or banking passwords.</li>
              <li><strong className="text-cream">Performance Statistics:</strong> Rating Points (RP), accuracy percentage, star levels, gameweek rankings, and historical prediction accuracy.</li>
              <li><strong className="text-cream">Technical & Device Data:</strong> IP address, device type, browser specifications, and local preferences (e.g., dark/light theme setting).</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <Database className="text-gold shrink-0" size={20} />
              <h2>2. How We Use Your Information</h2>
            </div>
            <p>We use the collected information for various legitimate purposes, including to:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Provide, operate, and maintain your MshindiRoom account and session state.</li>
              <li>Verify phone numbers via secure SMS authentication (Firebase Auth).</li>
              <li>Calculate consensus odds, punter rating points (RP), and global community leaderboards.</li>
              <li>Detect and prevent spam, harassment, unauthorized bot access, and fraudulent content.</li>
              <li>Send critical account alerts, moderation updates, and service announcements.</li>
              <li>Improve user experience, app performance, and feature design based on aggregate usage patterns.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <Eye className="text-gold shrink-0" size={20} />
              <h2>3. Public vs. Private Information</h2>
            </div>
            <div className="space-y-2">
              <p><strong className="text-cream">Publicly Visible Data:</strong> Your username, avatar, public punter rating (stars & RP), public picks, room comments, and leaderboard position are visible to other members of the community.</p>
              <p><strong className="text-cream">Private Data:</strong> Your phone number and security PIN are strictly confidential and are never disclosed publicly or sold to third-party marketers.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <UserCheck className="text-gold shrink-0" size={20} />
              <h2>4. Firebase & Data Security</h2>
            </div>
            <p>
              MshindiRoom utilizes industry-standard Google Firebase infrastructure (Firebase Authentication and Firestore Database) for cloud data storage and identity management.
            </p>
            <p>
              We implement technical safeguards, encryption protocols, and strict access control rules to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <Bell className="text-gold shrink-0" size={20} />
              <h2>5. Local Storage & Cookies</h2>
            </div>
            <p>
              We use browser local storage and essential cookies to save your active session tokens, theme preferences, and PWA installation state. These storage keys are required for the seamless function of the web app.
            </p>
          </section>

          {/* Section 6 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <FileText className="text-gold shrink-0" size={20} />
              <h2>6. Your Data Rights & Deletion (KDPA Compliant)</h2>
            </div>
            <p>
              In compliance with applicable data protection legislation (including the Kenya Data Protection Act, 2019), you have full rights to access, correct, export, or permanently erase your personal account data.
            </p>
            <p>
              To request account or data removal, please contact our support team through the automated support assistant (Ava) in the app or email us at <a href="mailto:support@mshindiroom.com" className="text-gold hover:underline font-mono">support@mshindiroom.com</a>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="bg-panel-2/40 border border-line/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-cream font-display font-bold text-lg">
              <Mail className="text-gold shrink-0" size={20} />
              <h2>7. Contact Us</h2>
            </div>
            <p>
              If you have any questions or suggestions regarding our Privacy Policy, do not hesitate to contact us at <a href="mailto:support@mshindiroom.com" className="text-gold hover:underline font-mono">support@mshindiroom.com</a> or view our <Link to="/terms" className="text-gold hover:underline font-semibold">Terms of Service</Link>.
            </p>
          </section>
        </div>

        {/* Footer Link */}
        <div className="border-t border-line pt-6 flex justify-between items-center text-xs text-cream-dim">
          <Link to="/terms" className="text-gold hover:underline font-semibold">Read Terms of Service &rarr;</Link>
          <Link to="/" className="text-cream-dim hover:text-cream">&larr; Back to Home</Link>
        </div>
      </motion.div>
    </div>
  );
}
