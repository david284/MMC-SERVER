# MMC Release Signing Key

This directory contains the **public GPG key** used to verify MMC release artifacts.

The corresponding private key is not stored in the repository.

## Verify a release

Import the public key:

```bash
gpg --import mmc-release-signing-public-key-TEST.asc
```

Verify the signed checksum file:

```bash
gpg --verify SHA256SUMS.asc SHA256SUMS
```

Then verify the downloaded release artifacts:

```bash
sha256sum -c SHA256SUMS
```

A valid GPG signature confirms that `SHA256SUMS` was signed using the MMC release signing key. The SHA-256 checksums then confirm that the downloaded artifacts have not been modified.

## Maintainer setup

Release signing uses a dedicated GPG key. The private key must **never** be committed to the repository.

Create a signing key:

```bash id="dyv3c8"
gpg --quick-generate-key \
  "MMC Release Signing <project-email>" \
  ed25519 sign 2y
```

Find the key fingerprint:

```bash id="c7t00a"
gpg --list-secret-keys \
  --keyid-format LONG \
  "MMC Release Signing"
```

Export the public key into this directory:

```bash id="cv2b2b"
gpg --armor \
  --export <fingerprint> \
  > Documents/keys/mmc-release-signing-public-key.asc
```

Export the private key temporarily:

```bash id="qv9nvi"
gpg --armor \
  --export-secret-keys <fingerprint> \
  > /tmp/mmc-release-signing-private-key.asc
```

In the GitHub repository, go to **Settings → Secrets and variables → Actions** and create or update these repository secrets:

* `RELEASE_GPG_PRIVATE_KEY` — the complete contents of `/tmp/mmc-release-signing-private-key.asc`.
* `RELEASE_GPG_PASSPHRASE` — the passphrase protecting the signing key.

Delete the temporary private-key export immediately afterwards:

```bash id="bd2hmg"
rm /tmp/mmc-release-signing-private-key.asc
```

Commit only the public key in `Documents/keys/`.

### Replacing or rotating the key

When replacing the release signing key:

1. Generate a new signing key.
2. Export and commit its public key.
3. Export its private key temporarily.
4. Update the GitHub Actions `RELEASE_GPG_PRIVATE_KEY` secret with the new private key.
5. Update the GitHub Actions `RELEASE_GPG_PASSPHRASE` secret with the new key's passphrase.
6. Delete the temporary private-key export.
7. Test a release and verify its `SHA256SUMS.asc` using the new public key.

Do not discard old public keys while releases signed with them may still need to be verified. Retain previous public keys with filenames identifying their period of use.

