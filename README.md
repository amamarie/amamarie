This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Marketing automation cron

Le module marketing utilise le cron `/api/cron/marketing` pour executer automatiquement:

- les relances de sequences dues, par exemple J0, J+3 et J+7;
- les campagnes marketing planifiees;
- la mise a jour des resultats marketing apres traitement.

En local, le cron est accessible sans secret lorsque `NODE_ENV` n'est pas `production`:

```bash
curl http://localhost:3000/api/cron/marketing
```

En production, ajouter une variable d'environnement `CRON_SECRET` avec une valeur longue et aleatoire. L'appel doit alors utiliser:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ton-domaine.com/api/cron/marketing
```

Sur Vercel, `vercel.json` planifie deja ce cron toutes les 15 minutes. Si `CRON_SECRET` est defini dans les variables d'environnement Vercel, Vercel envoie automatiquement l'en-tete `Authorization: Bearer $CRON_SECRET`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
