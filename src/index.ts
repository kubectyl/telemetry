interface TelemetryData {
  id: string;
  panel: {
    version: string;
    phpVersion: string;
    drivers: {
      cache: {
        type: string;
      };
      database: {
        type: string;
        version: string;
      };
    };
  };
  resources: {
    allocations: {
      count: number;
      used: number;
    };
    snapshots: {
      count: number;
      bytes: number;
    };
    rockets: {
      count: number;
      server_usage: {
        [key: string]: number;
      };
    };
    locations: {
      count: number;
    };
    mounts: {
      count: number;
    };
    launchpads: {
      count: number;
      server_usage: {
        [key: string]: number;
      };
    };
    clusters: {
      count: number;
    };
    servers: {
      count: number;
      suspended: number;
    };
    users: {
      count: number;
      admins: number;
    };
  };
  clusters: {
    id: string;
    version: string;
    kubernetes: {
      version: {
        major: string;
        minor: string;
        gitVersion: string;
        gitCommit: string;
        gitTreeState: string;
        buildDate: string;
        goVersion: string;
        compiler: string;
        platform: string;
      };
      nodes: {
        name: string;
        pods_num: number;
      }[];
      pod_status: {
        [key: string]: string;
      };
    };
    system: {
      architecture: string;
      cpuThreads: number;
      memoryBytes: number;
      kernelVersion: string;
      os: string;
      osType: string;
    };
  }[];
}

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "POST") {
      try {
        const rawData = await request.text();
        const data: TelemetryData = JSON.parse(rawData);

        // Validate if the received data is a valid JSON object
        if (typeof data === "object" && data !== null) {
          // Add the telemetry data to the database
          await addDataToDatabase(env.DB, data);

          // Return a success response
          return new Response("Telemetry data added to the database.", {
            status: 200,
          });
        } else {
          // Return an error response for invalid JSON data
          return new Response("Invalid JSON data.", { status: 400 });
        }
      } catch (error) {
        // Return an error response for any other errors
        return new Response("Error processing the request.", { status: 500 });
      }
    } else if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        const uuid = url.searchParams.get("uuid");

        if (!uuid) {
          // Return an error response if the uuid parameter is empty
          return new Response("UUID parameter is required.", { status: 400 });
        }

        const results = await env.DB.prepare(
          "SELECT data FROM telemetry WHERE uuid = ?"
        ).bind(uuid).all();

        // Return the query result as a JSON response
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      } catch (error) {
        console.error("Error executing SELECT query:", error);

        // Return an error response for any errors
        return new Response("Error executing SELECT query.", { status: 500 });
      }
    }

    // Return a default response for other routes
    return new Response("Invalid route.", { status: 404 });
  },
};

// Function to add telemetry data to the database
async function addDataToDatabase(db: D1Database, data: TelemetryData) {
  const telemetryUUID = data.id;
  const jsonData = JSON.stringify(data);

  await db.prepare(
    `INSERT INTO telemetry (uuid, data)
		VALUES (?, ?)
		ON CONFLICT (uuid)
		DO UPDATE SET data = excluded.data`
  )
    .bind(telemetryUUID, jsonData)
    .run();
}