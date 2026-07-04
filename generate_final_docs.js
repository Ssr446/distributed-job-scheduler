const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  WidthType, ExternalHyperlink, ImageRun
} = require("docx");
const fs = require("fs");
const path = require("path");

const PAGE = { width: 12240, height: 15840 }; // US Letter

// ---------- helpers ----------
function h1(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }); }
function h2(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }); }
function h3(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }); }
function p(text, opts = {}) { return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, ...opts })] }); }
function bullet(text, opts = {}) { return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 100 }, children: [new TextRun({ text, ...opts })] }); }
function img(filename) {
  const filepath = path.join(__dirname, 'extracted_docx', 'word', 'media', filename);
  if (!fs.existsSync(filepath)) return p(`[Missing Image: ${filename}]`, { color: "FF0000", italics: true });
  return new Paragraph({
    spacing: { after: 300 },
    children: [
      new ImageRun({
        data: fs.readFileSync(filepath),
        transformation: { width: 600, height: 337 }, // 16:9 ratio
      })
    ]
  });
}

function buildDoc(includeLive) {
  const children = [
    h1("Distributed Job Scheduler — Final Submission"),
    p("Candidate: ssrsh", { bold: true }),
    
    h2("1. Overview"),
    p("This project implements a multi-tenant, distributed job scheduler capable of orchestrating reliable background tasks across independent, horizontally scalable workers."),
    bullet("Database: PostgreSQL 16 (via Prisma ORM)"),
    bullet("Backend: Express.js, TypeScript, Zod"),
    bullet("Frontend: React, Vite, TailwindCSS, Zustand, Recharts"),
    bullet("Real-time: Socket.io for live metric streaming"),
    
    h2("2. Core Architecture"),
    bullet("API Server: Handles REST endpoints, authentication (JWT), RBAC, and enqueues jobs."),
    bullet("Worker Nodes: Independent processes that aggressively poll the queue, claim jobs atomically, and execute them."),
    bullet("Dashboard: A real-time monitoring interface connected via Socket.io."),
    
    h2("3. Database Schema (Entity-Relationship Diagram)"),
    p("The full PostgreSQL schema consists of 14 tables handling Users, Orgs, Projects, Queues, Jobs, Logs, and Workers."),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "View full ER Diagram on GitHub: " }),
        new ExternalHyperlink({
          children: [new TextRun({ text: "Prisma Schema Graph", style: "Hyperlink" })],
          link: "https://github.com/Ssr446/distributed-job-scheduler"
        })
      ]
    }),

    h2("4. Proof of Functionality (Screenshots)"),
    
    h3("4.1 Dashboard Overview"),
    p("Shows top-level metrics: Total Jobs, Completed, Failed, and Active Workers."),
    img("image1.png"),

    h3("4.2 Job Explorer & Logs"),
    p("Displays the comprehensive job list with search, filtering, and the job log modal open."),
    img("image2.png"),

    h3("4.3 Queue Configuration"),
    p("Shows a specific queue's configuration, pause/resume capability, and latency/status metrics."),
    img("image3.png"),

    h3("4.4 Dead Letter Queue"),
    p("Shows failed jobs that exceeded max retries, complete with AI-generated failure summaries and the Requeue action."),
    img("image4.png"),

    h3("4.5 Active Worker Heartbeat"),
    p("Shows the active workers currently polling the queues and executing tasks, with heartbeat timestamps."),
    img("image5.png"),

    h3("4.6 Metrics Chart"),
    p("Visualizes the system throughput (jobs completed over time) and resource usage stats."),
    img("image6.png"),
  ];

  if (includeLive) {
    children.push(
      h2("5. Live Deployment"),
      p("The dashboard and API have been deployed live to Render."),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "Live URL: " }),
          new ExternalHyperlink({
            children: [new TextRun({ text: "https://codity-dashboard.onrender.com", style: "Hyperlink" })],
            link: "https://codity-dashboard.onrender.com"
          })
        ]
      }),
      img("image7.png")
    );
  }

  const doc = new Document({
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: "bullet", text: "\u2022", alignment: "left" }] }
      ]
    },
    sections: [{ properties: { page: { size: PAGE } }, children }]
  });

  return doc;
}

async function run() {
  // Generate Local Version (Images 1-6)
  const localDoc = buildDoc(false);
  const localBuffer = await Packer.toBuffer(localDoc);
  fs.writeFileSync("Distributed_Job_Scheduler_Submission_Local.docx", localBuffer);
  console.log("Created: Distributed_Job_Scheduler_Submission_Local.docx");

  // Generate Live Version (Images 1-7)
  const liveDoc = buildDoc(true);
  const liveBuffer = await Packer.toBuffer(liveDoc);
  fs.writeFileSync("Distributed_Job_Scheduler_Submission_Live.docx", liveBuffer);
  console.log("Created: Distributed_Job_Scheduler_Submission_Live.docx");
}

run();
