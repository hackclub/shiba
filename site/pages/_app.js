import "@/styles/globals.css";
import AnimatedBackground from "@/components/AnimatedBackground";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Plausible Analytics */}
        <script 
          defer 
          data-domain="shiba.hackclub.com" 
          src="https://plausible.io/js/script.file-downloads.hash.outbound-links.pageview-props.tagged-events.js"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`
          }}
        />
      </Head>
      <AnimatedBackground />
      <Component {...pageProps} />
    </>
  );
}
