export type KumoFrontendConfig = {
  alchemyApiKey?: string;
  testnetOnly?: boolean;
};

const defaultConfig: KumoFrontendConfig = {
  alchemyApiKey: process.env.REACT_APP_ALCHEMY_API
};

function hasKey<K extends string>(o: object, k: K): o is Record<K, unknown> {
  return k in o;
}

const parseConfig = (json: unknown): KumoFrontendConfig => {
  const config = { ...defaultConfig };

  if (typeof json === "object" && json !== null) {
    if (hasKey(json, "alchemyApiKey") && json.alchemyApiKey !== "") {
      const { alchemyApiKey } = json;

      if (typeof alchemyApiKey === "string") {
        config.alchemyApiKey = alchemyApiKey;
      } else {
        console.error("Malformed alchemyApiKey:");
        console.log(alchemyApiKey);
      }
    }

    if (hasKey(json, "testnetOnly")) {
      const { testnetOnly } = json;

      if (typeof testnetOnly === "boolean") {
        config.testnetOnly = testnetOnly;
      } else {
        console.error("Malformed testnetOnly:");
        console.log(testnetOnly);
      }
    }
  } else {
    console.error("Malformed config:");
    console.log(json);
  }

  return config;
};

let configPromise: Promise<KumoFrontendConfig> | undefined = undefined;

const fetchConfig = async () => {
  try {
    const response = await fetch("config.json");

    if (!response.ok) {
      throw new Error(`Failed to fetch config.json (status ${response.status})`);
    }

    return parseConfig(await response.json());
  } catch (err) {
    console.error(err);
    return { ...defaultConfig };
  }
};

export const getConfig = (): Promise<KumoFrontendConfig> => {
  if (!configPromise) {
    configPromise = fetchConfig();
  }

  return configPromise;
};
