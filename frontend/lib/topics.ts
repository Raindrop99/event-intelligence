// Sidebar topic sections — keyword views over the analysed feed. Each slug must
// match a key in the backend intel.TOPICS map (see backend/intel.py).
export type Topic = { slug: string; label: string; icon: string; desc: string };

export const TOPICS: Topic[] = [
  { slug: "oil-gas", label: "Oil & Gas", icon: "oil",
    desc: "Oil, gas, OPEC and ADNOC news that drives Abu Dhabi's revenue." },
  { slug: "tourism", label: "Tourism", icon: "tourism",
    desc: "Hospitality, travel, attractions and the visitor economy." },
  { slug: "transportation", label: "Transportation", icon: "transport",
    desc: "Aviation, rail, road and mobility developments." },
  { slug: "shipping", label: "Shipping Lines", icon: "ship",
    desc: "Ports, vessels, containers and maritime freight." },
  { slug: "exports", label: "Exports", icon: "export",
    desc: "Abu Dhabi's outbound trade and export activity." },
  { slug: "imports", label: "Imports", icon: "import",
    desc: "Inbound trade, customs and import activity." },
  { slug: "trade", label: "Exports & Imports", icon: "trade",
    desc: "Trade both ways — tariffs, deals and the trade balance." },
  { slug: "road-accidents", label: "Road Accidents", icon: "roadalert",
    desc: "Road-safety incidents, crashes and traffic developments." },
  { slug: "crime", label: "Crime", icon: "crime",
    desc: "Crime, fraud, smuggling and law-enforcement news." },
];

export const TOPIC_MAP: Record<string, Topic> =
  Object.fromEntries(TOPICS.map((t) => [t.slug, t]));
