# Sauvegardes hebdomadaires FinAssuro

Le workflow GitHub Actions `.github/workflows/weekly-backup.yml` lance une sauvegarde chaque dimanche a 08:00 UTC et peut aussi etre declenche manuellement.

Il fait trois operations:

- cree un tag Git du code, par exemple `backup/finassuro-2026-06-09`;
- exporte la base PostgreSQL avec `pg_dump`;
- exporte les variables d'environnement Vercel de production.

Les fichiers sensibles sont chiffres avec `BACKUP_GPG_PUBLIC_KEY` avant d'etre conserves comme artefacts GitHub Actions ou envoyes vers S3.

## Retention

Les artefacts GitHub Actions sont supprimes automatiquement apres 30 jours par defaut.

Les tags Git `backup/finassuro-YYYY-MM-DD` sont supprimes automatiquement apres 90 jours par defaut.

Ces valeurs peuvent etre changees avec des variables GitHub:

```env
BACKUP_ARTIFACT_RETENTION_DAYS="30"
BACKUP_TAG_RETENTION_DAYS="90"
```

La purge automatique ne supprime que les tags qui respectent le format `backup/finassuro-YYYY-MM-DD`.

## Secrets GitHub a configurer

Obligatoire pour chiffrer les sauvegardes sensibles:

```env
BACKUP_GPG_PUBLIC_KEY="-----BEGIN PGP PUBLIC KEY BLOCK-----..."
```

Pour la base de donnees:

```env
DATABASE_URL="postgresql://..."
```

Pour Vercel:

```env
VERCEL_TOKEN="..."
VERCEL_ORG_ID="..."
VERCEL_PROJECT_ID="..."
```

Pour l'envoi optionnel vers S3:

```env
BACKUP_S3_BUCKET="nom-du-bucket"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="ca-central-1"
```

Variable GitHub optionnelle:

```env
BACKUP_S3_PREFIX="finassuro"
BACKUP_ARTIFACT_RETENTION_DAYS="30"
BACKUP_TAG_RETENTION_DAYS="90"
```

## Cle GPG

La cle publique va dans GitHub Secrets. La cle privee doit rester hors GitHub, dans un coffre securise.

Exemple de generation locale:

```bash
gpg --quick-generate-key "FinAssuro Backups <backups@finassuro.com>" rsa4096 encrypt 2y
gpg --armor --export "FinAssuro Backups <backups@finassuro.com>"
```

## Restaurer la base

```bash
gpg --decrypt finassuro-postgres-YYYY-MM-DD.dump.gpg > finassuro-postgres-YYYY-MM-DD.dump
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DATABASE_URL" finassuro-postgres-YYYY-MM-DD.dump
```

## Restaurer les variables Vercel

```bash
gpg --decrypt finassuro-vercel-production-env-YYYY-MM-DD.env.gpg > vercel-production.env
```

Verifier les valeurs avant de les remettre dans Vercel.
