import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Scan a site with InternetSecure.org and return parsed results
 * @param {string} url - any http/https URL (we extract the hostname)
 * @returns {Promise<{rawHtml:string, sections:Record<string,string>}>}
 */
export async function scanWithInternetSecure(url) {
  try {
    const host = new URL(url).hostname;
    const scanUrl = `https://internetsecure.org/?domain=${encodeURIComponent(host)}`;
    
    console.log(`Scanning ${host} with InternetSecure.org...`);
    const { data: html } = await axios.get(scanUrl, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 60000 
    });

    // Load the HTML into Cheerio
    const $ = cheerio.load(html);
    const sections = {};

    // Every "h3" element in the markup starts a section
    $("h3").each((_, h3) => {
      const title = $(h3).text().replace(/:$/, "").trim();
      const body = $(h3).nextUntil("h3").text().trim();
      if (title && body) {
        sections[title] = body;
      }
    });

    return { rawHtml: html, sections };     // sections is LLM-friendly
  } catch (err) {
    console.error("Error scanning with InternetSecure:", err);
    return { error: err.message };
  }
}

/**
 * Format scan results for the LLM
 * @param {Object} scanResult - The result object from scanWithInternetSecure
 * @returns {string} - Formatted text for the LLM
 */
export function formatSecurityScanForLLM(scanResult) {
  if (scanResult.error) {
    return `Security scan error: ${scanResult.error}`;
  }
  
  if (!scanResult.sections || Object.keys(scanResult.sections).length === 0) {
    return "No security scan results available.";
  }
  
  return Object.entries(scanResult.sections)
    .map(([title, body]) => `## ${title}\n${body}`)
    .join("\n\n");
}