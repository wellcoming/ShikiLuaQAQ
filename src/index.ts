import JSZip from 'jszip';

export interface Env { }

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

        // match {appid}.zip or {appid}.lua
        const match = path.match(/^(\d+)\.(zip|lua)$/);
        if (!match) {
            return new Response('Not Found', { status: 404 });
        }

        const appidStr = match[1];
        const ext = match[2];
        const appid = parseInt(appidStr, 10);

        // Calculate folder hash
        const start = Math.floor(appid / 20000) * 20000;
        const salt = `SHIKIKAWAII${String(start).padStart(5, '0')}-${start + 19999}`;
        const folderHash = (await sha256Hex(salt)).substring(0, 24);

        // GitHub raw content URL (attaching timestamp to prevent caching)
        const githubUrl = `https://raw.githubusercontent.com/ShikieikiC/ShikiLuaQAQ/main/luas/${folderHash}/${appid}.lua?t=${Date.now()}`;

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

        if (ext === 'lua') {
            return new Response(luaContent, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${appid}.lua"`
                }
            });
        }

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
