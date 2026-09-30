const command = process.argv[2] ?? "help";

const printHelp = (): void => {
  console.log(`seznam-skol

Usage:
  npm run cli -- <command>

Commands:
  help            Show this help
  health          Verify that the CLI runtime starts

Planned:
  import-schools  Import schools from the authoritative registry
  crawl           Crawl school websites
  export          Export verified contacts
`);
};

switch (command) {
  case "help":
  case "--help":
  case "-h":
    printHelp();
    break;

  case "health":
    console.log(
      JSON.stringify({
        status: "ok",
        service: "seznam-skol",
        timestamp: new Date().toISOString(),
      }),
    );
    break;

  default:
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exitCode = 1;
}
