import JSZip from 'jszip';

export interface Env { }

// Web Crypto SHA256 helper
async function sha256Hex(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const url = new URL(request.url);
        const path = url.pathname.slice(1); // remove leading slash

        // match {appid}.zip
        const match = path.match(/^(\d+)\.zip$/);
        if (!match) {
            return new Response('Not Found', { status: 404 });
        }

        const appidStr = match[1];
        const appid = parseInt(appidStr, 10);

        // Calculate folder hash
        const start = Math.floor(appid / 20000) * 20000;
        const end = start + 19999;

        // As seen in the Python testing, start 0 is "00000"
        let startStr = start.toString();
        if (start === 0) {
            startStr = "00000";
        }

        const salt = `SHIKIKAWAII${startStr}-${end}`;
        const hash = await sha256Hex(salt);
        const folderHash = hash.substring(0, 24);

        // GitHub raw content URL (attaching timestamp to prevent caching)
        const githubUrl = `https://raw.githubusercontent.com/wellcoming/ShikiLuaQAQ/main/luas/${folderHash}/${appid}.lua?t=${Date.now()}`;

        const githubResponse = await fetch(githubUrl, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!githubResponse.ok) {
            return new Response(`Failed to fetch lua file. Status: ${githubResponse.status}`, { status: githubResponse.status });
        }

        const luaContent = await githubResponse.arrayBuffer();

        // Create a zip file containing the lua file
        const zip = new JSZip();
        zip.file(`${appid}.lua`, luaContent);
        const zipData = await zip.generateAsync({ type: 'uint8array' });

        return new Response(zipData, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${appid}.zip"`
            }
        });
    },
};