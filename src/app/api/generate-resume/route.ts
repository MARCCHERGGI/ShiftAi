import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import getStream from "get-stream";
import { PassThrough } from "stream";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const {
      fullName = "No Name",
      email = "",
      phone = "",
      position = "",
      summary = "",
      skills = "",
      experience = "",
    } = data;

    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(fullName, { align: "center" });
    doc.moveDown(0.3);

    const contactParts = [email, phone].filter(Boolean);
    if (contactParts.length > 0) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666666")
        .text(contactParts.join("  |  "), { align: "center" });
    }
    if (position) {
      doc
        .fontSize(11)
        .font("Helvetica-Oblique")
        .fillColor("#444444")
        .text(position, { align: "center" });
    }

    // Divider
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.5);

    // Professional Summary
    if (summary) {
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#333333")
        .text("PROFESSIONAL SUMMARY");
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#444444")
        .text(summary, { lineGap: 2 });
      doc.moveDown(0.5);
    }

    // Skills
    if (skills) {
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#333333")
        .text("SKILLS");
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#444444")
        .text(skills, { lineGap: 2 });
      doc.moveDown(0.5);
    }

    // Experience
    if (experience) {
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#333333")
        .text("EXPERIENCE");
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#444444")
        .text(experience, { lineGap: 2 });
      doc.moveDown(0.5);
    }

    // Footer
    doc.moveDown(1);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#999999")
      .text("Generated with ShiftAI", { align: "center" });

    doc.end();

    const buffer = await getStream.buffer(stream);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fullName.replace(/[^a-zA-Z0-9]/g, "_")}_resume.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
