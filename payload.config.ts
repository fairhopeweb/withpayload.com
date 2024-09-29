import path from "path";
import { fileURLToPath } from "url";

import { BlogCollections } from "@/_features/blog/collections";
import { seedBlog } from "@/_features/blog/seed";
import { GlobalsCollections } from "@/_features/globals/collections";
import { GlobalSettings } from "@/_features/globals/globals";
import { seedGlobal } from "@/_features/globals/seed";
import { ProjectsCollections } from "@/_features/projects/collections";
import { seedProjects } from "@/_features/projects/seed";
import { UsersCollections } from "@/_features/users/collections";
import { S3_PLUGIN_CONFIG } from "@/utils/s3";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage as s3StoragePlugin } from "@payloadcms/storage-s3";
import { buildConfig, Payload } from "payload";
import { en } from "payload/i18n/en";
import sharp from "sharp";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "set-a-secret-in-your-env",
  collections: [
    ...GlobalsCollections,
    ...UsersCollections,
    ...ProjectsCollections,
    ...BlogCollections,
  ],
  debug: true,
  globals: [GlobalSettings],
  admin: {
    autoLogin: {
      email:
        isDevelopment && !isProduction
          ? "admin@withpayload.com"
          : "user@withpayload.com",
      password:
        isDevelopment && !isProduction ? process.env.ADMIN_PASSWORD : "test",
      prefillOnly: true,
    },
  },
  // the type of DB you would like to use
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    idType: "uuid",
    push: false,
  }),

  // richText editor
  editor: lexicalEditor(),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  i18n: {
    supportedLanguages: { en },
  },
  plugins: [
    s3StoragePlugin({
      ...S3_PLUGIN_CONFIG,
      collections: {
        ["media"]: {
          disableLocalStorage: true,
          generateFileURL: (args: any) => {
            return `https://${process.env.NEXT_PUBLIC_S3_HOSTNAME}/${args.prefix}/${args.filename}`;
          },
          prefix: process.env.NEXT_PUBLIC_UPLOAD_PREFIX || "media",
        },
      },
    }),
  ],
  graphQL: {
    disable: true,
  },
  sharp,
  onInit: async (payload: Payload) => {
    try {
      const hasUsers = await payload.find({
        collection: "users",
        limit: 1,
        where: {
          role: {
            equals: "admin",
          },
        },
      });

      if (hasUsers.docs.length === 0) {
        console.log("Starting initialization process...");

        console.log("Creating global settings...");
        await seedGlobal(payload);

        console.log("Creating blog...");
        await seedBlog(payload);

        console.log("Creating projects...");
        await seedProjects(payload);

        console.log("Setup complete");
      } else {
        console.log("Initialization already completed. Skipping setup.");
      }
    } catch (error) {
      console.error("Error during initialization:");
      console.error(JSON.stringify(error, null, 2));
    }
  },
});