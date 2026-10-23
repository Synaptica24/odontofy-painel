import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/hoje", "/agenda", "/pacientes", "/conversas", "/financeiro", "/ajustes", "/entrar", "/api/", "/assinar/"] },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
