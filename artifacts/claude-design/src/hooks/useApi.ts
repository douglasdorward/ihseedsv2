import { useEffect, useState } from "react";

export type Product = {
  id: number;
  name: string;
  slug?: string | null;
  price: string;
  packSize: string;
  status: "in-stock" | "low" | "very-low" | "unavailable";
  note: string;
  details?: {
    relatedProducts?: string[];
  };
};

export type EnquiryForm = {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
};

const fallbackProducts: Product[] = [
  { id: 1, name: "SouWest™ Pasture Mix", price: "$25.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "Blended to order, 500 mm+ zones" },
  { id: 2, name: "Maximix", price: "$25.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "Versatile pasture mix for broad-acre sowing" },
  { id: 3, name: "Silahay™ Mix", price: "$25.00 per kg", packSize: "25 kg bag", status: "low", note: "Hay and silage, mid rainfall" },
  { id: 4, name: "Self Regeneration Pasture Mix", price: "$25.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "Built for persistence and recovery" },
  { id: 5, name: "Ceres PG One50 Ryegrass", price: "$14.50 per kg", packSize: "25 kg bag", status: "in-stock", note: "Perennial, 600 mm+ zones" },
  { id: 6, name: "Margurita French Serradella", price: "$9.80 per kg", packSize: "25 kg bag", status: "low", note: "Reliable early-season legume" },
  { id: 7, name: "SARDI Seven Lucerne", price: "$18.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "High quality feed for rotational systems" },
  { id: 8, name: "Dalkeith Subterranean Clover", price: "$11.20 per kg", packSize: "25 kg bag", status: "very-low", note: "Early season, 325–450 mm" },
];

export function slugify(text: string) {
  return text.toLowerCase().replace(/™/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export function productPath(product: Pick<Product, "name" | "slug">) {
  return `/products/${product.slug || slugify(product.name)}`;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Catalogue unavailable")))
      .then((data: Product[]) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading };
}

export function useAvailability() {
  const [products, setProducts] = useState<Omit<Product, "price" | "packSize">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/availability")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Catalogue unavailable")))
      .then((data: Omit<Product, "price" | "packSize">[]) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading };
}

export function useEnquiry() {
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form, setForm] = useState<EnquiryForm>({ name: "", email: "", phone: "", topic: "General advice", message: "" });

  const submitEnquiry = async (event: React.FormEvent<HTMLFormElement>, extraContext = "") => {
    event.preventDefault();
    setSubmitState("sending");
    try {
      const message = [form.message, extraContext].filter(Boolean).join("\n\n");
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, message }) });
      if (!response.ok) throw new Error("Unable to send enquiry");
      setSubmitState("sent");
      setForm({ name: "", email: "", phone: "", topic: "General advice", message: "" });
    } catch {
      setSubmitState("error");
    }
  };

  return { form, setForm, submitState, submitEnquiry };
}

// Global data shared across pages
export const articleSeed = [
  { category: "Editorial", date: "27 October 2025", title: "Mix & Match Custom Pasture", excerpt: "The need for sustainable and productive pastures has never been greater in today’s farming landscape.", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80" },
  { category: "Sowing & Timing", date: "12 September 2025", title: "Getting Your Autumn Sowing Window Right", excerpt: "Timing decides the season. Soil temperature, rainfall triggers and the sowing rates that hold up.", image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=80" },
  { category: "Feed Planning", date: "4 August 2025", title: "Feed Planning Through a Dry Finish", excerpt: "Practical steps for holding feed quality when the season shortens.", image: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=1000&q=80" },
  { category: "Regional Advice", date: "18 July 2025", title: "Choosing a Mix for Your Rainfall Zone", excerpt: "A practical starting point for matching pasture performance to the country you farm.", image: "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1000&q=80" },
];

export const imageOptions = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];
