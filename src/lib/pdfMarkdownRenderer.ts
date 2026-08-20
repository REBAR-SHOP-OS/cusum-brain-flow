/**
 * Renders markdown-formatted text into a jsPDF document with proper formatting.
 * Handles: ## headings, **bold**, - bullets, and plain text.
 */
export function addMarkdownToPdf(
  doc: any,
  text: string,
  options: { margin: number; maxWidth: number; pageHeight: number; startY: number }
): number {
  let y = options.startY;
  const { margin, maxWidth, pageHeight } = options;
  const lines = text.split("\n");

  const checkPageBreak = (needed = 6) => {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 3;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      // Section heading
      checkPageBreak(12);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 80);
      const heading = trimmed.replace(/^##\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      doc.text(heading, margin, y);
      y += 7;
    } else if (trimmed.startsWith("# ")) {
      // Top-level heading
      checkPageBreak(14);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(20, 20, 80);
      const heading = trimmed.replace(/^#\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      doc.text(heading, margin, y);
      y += 8;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      // Bullet point
      const raw = trimmed.slice(2);
      const hasBoldPrefix = /^\*\*(.*?)\*\*[:\s]/.exec(raw);

      if (hasBoldPrefix) {
        // Bold label + normal text: "**Label:** rest"
        const boldPart = hasBoldPrefix[1];
        const rest = raw.slice(hasBoldPrefix[0].length).replace(/\*\*(.*?)\*\*/g, "$1");

        checkPageBreak(6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text("•", margin + 2, y);

        doc.setFont("helvetica", "bold");
        doc.text(boldPart + ":", margin + 8, y);
        const boldWidth = doc.getTextWidth(boldPart + ": ");

        if (rest.trim()) {
          doc.setFont("helvetica", "normal");
          const restWrapped = doc.splitTextToSize(rest.trim(), maxWidth - 8 - boldWidth);
          doc.text(restWrapped[0], margin + 8 + boldWidth, y);
          y += 4.5;
          for (let i = 1; i < restWrapped.length; i++) {
            checkPageBreak(5);
            doc.text(restWrapped[i], margin + 8, y);
            y += 4.5;
          }
        } else {
          y += 4.5;
        }
      } else {
        // Simple bullet
        const content = raw.replace(/\*\*(.*?)\*\*/g, "$1");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const wrapped = doc.splitTextToSize(content, maxWidth - 10);
        checkPageBreak(5);
        doc.text("•", margin + 2, y);
        for (const wl of wrapped) {
          checkPageBreak(5);
          doc.text(wl, margin + 8, y);
          y += 4.5;
        }
      }
    } else {
      // Normal text — check if entire line is bold
      const fullBoldMatch = /^\*\*(.*)\*\*$/.exec(trimmed);
      if (fullBoldMatch) {
        checkPageBreak(6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        const wrapped = doc.splitTextToSize(fullBoldMatch[1], maxWidth);
        for (const wl of wrapped) {
          checkPageBreak(5);
          doc.text(wl, margin, y);
          y += 4.5;
        }
      } else {
        // Plain text — strip inline bold markers
        const content = trimmed.replace(/\*\*(.*?)\*\*/g, "$1");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        const wrapped = doc.splitTextToSize(content, maxWidth);
        for (const wl of wrapped) {
          checkPageBreak(5);
          doc.text(wl, margin, y);
          y += 4.5;
        }
      }
    }
  }

  return y;
}
