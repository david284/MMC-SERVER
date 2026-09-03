// .github/scripts/generate-third-party-licenses.js

const checker = require("license-checker");
const fs = require("fs");
const path = require("path");

const distributionDirectory = path.resolve("dist/MMC");
const applicationDirectory = path.join(distributionDirectory, "app");
const licensesDirectory = path.join(distributionDirectory, "licenses");
const outputFile = path.join(
  licensesDirectory,
  "THIRD-PARTY-LICENSES.txt"
);

checker.init(
  {
    start: applicationDirectory,
    production: true,
  },
  (error, packages) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    const entries = Object.entries(packages)
      // MMC itself is covered separately by MMC-SERVER-LICENSE.txt.
      .filter(([name]) => !name.startsWith("MMC@"))
      .sort(([a], [b]) => a.localeCompare(b));

    const invalidLicenses = entries.filter(
      ([, info]) =>
        !info.licenses ||
        info.licenses === "UNKNOWN" ||
        info.licenses === "UNLICENSED" ||
        !info.licenseFile
    );

    if (invalidLicenses.length > 0) {
      console.error("Incomplete licence information for:");

      for (const [name, info] of invalidLicenses) {
        console.error(
          `  ${name}: licence=${info.licenses || "unknown"}, ` +
          `file=${info.licenseFile || "none"}`
        );
      }

      process.exit(1);
    }

    const sections = entries.map(([name, info]) => {
      const licenseText = fs
        .readFileSync(info.licenseFile, "utf8")
        .trim();

      return [
        "=".repeat(80),
        name,
        `License: ${info.licenses}`,
        "=".repeat(80),
        "",
        licenseText,
        "",
      ].join("\n");
    });

    const header = [
      "MMC Third-Party Software Licences",
      "",
      "This file contains licence information for production npm dependencies",
      "distributed with MMC.",
      "",
    ].join("\n");

    fs.mkdirSync(licensesDirectory, { recursive: true });

    fs.writeFileSync(
      outputFile,
      header + sections.join("\n"),
      "utf8"
    );

    console.log(
      `Generated ${outputFile} containing ${entries.length} dependencies.`
    );
  }
);
