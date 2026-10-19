import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://x0k.github.io",
  base: "/schema-introspection",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Schema introspection",
      description: "A protocol for schema introspection: typed nodes and lazily resolved edges.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/x0k/schema-introspection",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/x0k/schema-introspection/edit/main/apps/docs/",
      },
      sidebar: [
        {
          label: "Protocol",
          items: [
            { label: "Overview", link: "/" },
            { label: "Protocol", link: "/protocol/" },
          ],
        },
        {
          label: "Adapters",
          items: [
            { label: "Overview", link: "/adapters/" },
            { label: "JSON Schema draft-07", link: "/adapters/json-schema-draft-07/" },
            { label: "JSON Schema 2020-12", link: "/adapters/json-schema-2020-12/" },
            { label: "Zod", link: "/adapters/zod/" },
            { label: "Valibot", link: "/adapters/valibot/" },
          ],
        },
        {
          label: "Development",
          items: [{ label: "Development", link: "/development/" }],
        },
      ],
    }),
  ],
});
