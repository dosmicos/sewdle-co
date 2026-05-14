function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("create-ugc-discount enables the UGC favorites landing for new links", () => {
  assertEquals(source.includes("const DEFAULT_UGC_LANDING_PATH = '/pages/favoritos-ugc'"), true);
  assertEquals(source.includes("const DEFAULT_UGC_LANDING_VARIANT = 'favoritos_ugc_v1_default'"), true);
  assertEquals(source.includes("landing_enabled: true"), true);
  assertEquals(source.includes("landing_path: DEFAULT_UGC_LANDING_PATH"), true);
  assertEquals(source.includes("landing_variant: DEFAULT_UGC_LANDING_VARIANT"), true);
});
