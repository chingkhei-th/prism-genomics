import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Read the Handlebars template
    const templatePath = path.join(process.cwd(), "src", "templates", "report.hbs");
    const templateSource = fs.readFileSync(templatePath, "utf8");

    // Compile template
    const template = Handlebars.compile(templateSource);
    const html = template(data);

    // Launch headless Chromium
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Inject the HTML
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "30px", right: "20px", bottom: "30px", left: "20px" },
    });

    await browser.close();

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="PRISM_Risk_Report.pdf"',
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error.message },
      { status: 500 }
    );
  }
}
