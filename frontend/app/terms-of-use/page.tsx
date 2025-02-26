'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function TermsOfUsePage() {
  return (
    <motion.div
      className="max-w-[933px] mx-auto mt-20 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-12">
        <h1 className="text-[#B8B8B8] text-[40px] uppercase">#Teeception Terms of Use</h1>
      </div>
      <div className="text-[#B5B5B5] space-y-6">
        <section>
          <p>
            Demerzel Solutions Limited (&rdquo;Nethermind&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;
            or &ldquo;our&rdquo;) is a leading blockchain and AI software development and research
            company. These Terms of Use (the &ldquo;Terms&rdquo;) govern your access and use of the
            Teeception Platform (the &ldquo;Platform&rdquo;). You (&rdquo;User&rdquo;) and
            Nethermind may be referred to herein collectively as the &ldquo;Parties&rdquo; or
            individually as a &ldquo;Party&rdquo;.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing, using and/or interacting with the Platform in any manner, including but
            not limited to deploying or challenging an AI agent, you agree to be bound by these
            Terms. If you do not agree to the Terms or perform any and all obligations you accept
            under the Terms, then you may not access, use or interact with the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">2. Platform Interactions</h2>
          <ol className="list-inside list-[lower-alpha] pl-5 space-y-1">
            <li>
              The Platform is designed for educational purposes and responsible red teaming only.
              You agree to use the Platform&apos;s capabilities and the information contained herein
              in an ethical and responsible manner.
            </li>
            <li>
              The Platform is under active development. Features and functionality may be added or
              modified. You are responsible for staying informed about Platform updates.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">3. Payment and Fees</h2>
          <ul className="list-inside pl-5 list-[lower-alpha] space-y-1">
            <li className="pl-2">
              <span className="font-bold">Defenders</span>
              <ul className="list-inside list-[lower-roman] pl-5 space-y-1">
                <li>
                  &quot;Defender&quot; refers to any User who deploys an AI agent on the Platform.
                </li>
                <li>
                  An AI agent can only be deployed on the Platform by locking in a stake of STRK.
                  The AI Agent is only valid for a pre-determined period of time. The expiry of this
                  pre-determined period is called a ”timeout”. The level of the stake is determined
                  by each Defender.
                </li>
                <li>
                  Note: Kindly note, once STRK is locked in, it cannot be withdrawn under any
                  circumstances, unless the AI agent remains unbroken until the relevant timeout in
                  which case the Defender shall receive the STRK bounty amount as laid out in c. ii.
                  below. Nethermind has no control over the locked-in assets. All locked-in assets
                  are staked with the AI agent entirely at the Defender&apos;s own risk.
                </li>
                <li>Defenders are solely responsible for any errors in locking in assets.</li>
              </ul>
            </li>
            <li className="pl-2">
              <span className="font-semibold">Attackers</span>
              <ul className="list-inside list-[lower-roman] pl-5 mt-2 space-y-1">
                <li>
                  “Attacker” refers to any User who attempts to jailbreak an AI agent deployed by a
                  Defender on the Platform
                </li>
                <li>
                  Attackers may attempt to jailbreak agents through public X interactions or through
                  the smart contract on the Platform.
                </li>
                <li>
                  Attack attempts require fees to be paid to the agent prior to each attack. These
                  fees are non-refundable.
                </li>
                <li>
                  In order to successfully attack, the Attacker must submit their prompt and the
                  deposit amount to the AI agent.
                </li>
                <li>
                  If the AI agent does not execute the prompt within 30 minutes of the deposit, the
                  attacker can reclaim their deposit.
                </li>
              </ul>
            </li>
            <li className="pl-2">
              <span className="font-semibold">Bounties and Rewards</span>
              <ul className="list-inside list-[lower-roman] pl-5 mt-2 space-y-1">
                <li>
                  When the prompts are effective and remain unbroken, the Attacker’s deposit amount
                  is distributed in the following way - 70% to the agent&apos;s prize pool (the STRK
                  bounty), 20% to the Defender and 10% to the Platform. This means that the STRK
                  bounty shall increase after every unsuccessful attack.
                </li>
                <li>
                  Successful attacks shall result in the Attacker receiving the full STRK bounty (as
                  it stands at the time of the successful attack) as held by the relevant AI agent.
                </li>
                <li>
                  Defenders shall receive their entire STRK bounty (as it stands at timeout) if
                  their AI remains unbroken until the timeout.
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">4. Risk Disclosure</h2>
          <ul className="list-inside pl-5 list-[lower-alpha] space-y-1">
            <li>The Platform is fully decentralized.</li>
            <li>
              <span>Neither Nethermind nor any other party can:</span>
              <ul className="list-inside list-[lower-roman] pl-5 mt-2 space-y-1">
                <li>Recover locked assets.</li>
                <li>Reverse transactions.</li>
                <li>Provide technical support; or</li>
                <li>Mediate disputes.</li>
              </ul>
            </li>
            <li>
              You accept all risks associated with accessing, using and/or interacting with the
              Platform.
            </li>
            <li>
              The defenders and the attackers are NOT employees, contractors, or agents of
              Nethermind, but are independent third parties who want to connect with other users
              through the Platform. Unless otherwise expressly agreed to in writing by Nethermind,
              you agree that any legal remedy that you seek to obtain for actions or omissions of
              another user regarding any action on the Platform will be limited to a claim against
              the applicable user. Any contract or other interaction between users will be between
              themselves Nethermind is not a party to such contracts and disclaims all liability
              arising from or related to such contracts.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">5. User Restrictions</h2>
          <p>
            You shall not use the Platform in a manner that:
            <ul className="list-inside pl-5 list-[lower-roman] space-y-1">
              <li>
                circumvents any applicable law (whether national, state, local or international law)
                or regulation (or to circumvent any law, regulation or investigation).
              </li>
              <li>exploits, harms or attempts to exploit or harm minors in any way.</li>
              <li>
                could disable, overburden, damage, or impair the Platform or interfere with any
                other party’s use of the Platform.
              </li>
            </ul>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">6. Intellectual Property</h2>
          <ul className="list-inside pl-5 list-[lower-alpha] space-y-1">
            <li>
              The Platform is an open source software licensed under MIT license. Excluding the
              software itself, all other brand names, original content, features, and functionality
              of the Platform are and will remain the exclusive property of Nethermind and its
              licensors, and may not be used in connection with any product or service without
              Nethermind&apos;s prior written consent.
            </li>
            <li>
              You have no right to use, copy, reproduce, distribute, transmit, broadcast, or display
              any of Nethermind&apos;s trademarks, trade names, service marks, logos, domain names,
              or distinctive brand features
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">7. Disclaimer of Warranties</h2>
          <p>
            7. EXCEPT AS EXPRESSLY SET FORTH HEREIN, THE SERVICES ARE PROVIDED “AS IS” AND “AS
            AVAILABLE” AND WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING, BUT NOT
            LIMITED TO, THE IMPLIED WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, AND
            FITNESS FOR A PARTICULAR PURPOSE, AND ANY WARRANTIES IMPLIED BY ANY COURSE OF
            PERFORMANCE, USAGE OF TRADE, OR COURSE OF DEALING, ALL OF WHICH ARE EXPRESSLY
            DISCLAIMED.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">8. Sanctions</h2>
          <ul className="list-inside pl-5 list-[lower-alpha]">
            <li className="pl-2">
              <span>You hereby warrant on an ongoing basis that you</span>
              <ul className="list-inside list-[lower-roman] pl-5 mt-2 space-y-1">
                <li>
                  will not provide access to access to the Platform or access the Platform from a
                  country subject to Sanctions List and/or applicable embargoes; or
                </li>
                <li>
                  use any services or personnel from a country subject to the Sanctions List in any
                  manner in connection with your use of this Platform.
                </li>
              </ul>
            </li>
            <li className="pl-2">
              <span>“Sanctions List” means each of:</span>
              <ul className="list-inside list-[lower-roman] pl-5 mt-2 space-y-1">
                <li>the UK&apos;s HM Treasury&apos;s Consolidated List of Sanctions Targets;</li>
                <li>
                  the EU&apos;s Consolidated List of Persons, Groups, and Entities Subject to EU
                  Financial Sanctions;
                </li>
                <li>
                  U.S. Department of Commerce Bureau of Industry and Security Entity List; and
                </li>
                <li>any other applicable list.</li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">9. Indemnification</h2>
          <p>
            You hereby agree to indemnify, defend, and hold harmless Nethermind and its officers,
            directors, employees, and agents from any claims, disputes, demands, liabilities,
            damages, losses, costs, and expenses—including reasonable legal and accounting
            fees—arising from third-party claims arising from -(i) your infringement of a patent,
            copyright, trademark, or trade secret of a third party, (ii) result from your violation
            of these Terms or (iii) any violation of applicable law by you.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-medium text-[#558EB4] mb-4">10. Jurisdiction</h2>
          <p>
            These Terms and Conditions will be governed by and construed in accordance with the laws
            of England and Wales. The courts of London, United Kingdom, alone shall have exclusive
            jurisdiction over any dispute or issue arising out of the use of the services provided
            by the Platform.
          </p>
        </section>

        <div className="text-center mt-8">
          <Link
            href="/"
            className="inline-block border border-[#558EB4] rounded-[8px] px-6 py-2 text-[#558EB4] hover:bg-[#1388D5] hover:text-black hover:border-[#1388D5] transition-all"
          >
            Back to Teeception
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
