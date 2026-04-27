import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";
import fs from "fs";
import path from "path";

function localDictionaryPlugin() {
	return {
		name: 'local-dictionary',
		configureServer(server: any) {
			server.middlewares.use((req: any, res: any, next: any) => {
				const dictPath = path.resolve(process.cwd(), 'custom-dictionary.json');
				
				if (req.url === '/api/dictionary' && req.method === 'GET') {
					if (fs.existsSync(dictPath)) {
						res.setHeader('Content-Type', 'application/json');
						res.statusCode = 200;
						res.end(fs.readFileSync(dictPath, 'utf-8'));
					} else {
						res.setHeader('Content-Type', 'application/json');
						res.statusCode = 200;
						res.end('{}');
					}
					return;
				}

				if (req.url === '/api/dictionary' && req.method === 'POST') {
					let body = '';
					req.on('data', (chunk: any) => { body += chunk.toString(); });
					req.on('end', () => {
						try {
							fs.writeFileSync(dictPath, body);
							res.setHeader('Content-Type', 'application/json');
							res.statusCode = 200;
							res.end(JSON.stringify({ success: true }));
						} catch (e: any) {
							res.setHeader('Content-Type', 'application/json');
							res.statusCode = 500;
							res.end(JSON.stringify({ error: e.message }));
						}
					});
					return;
				}
				
				next();
			});
		}
	}
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		solidPlugin(),
		localDictionaryPlugin(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
			manifest: {
				name: "MTG Proxy Maker",
				short_name: "MTG Proxy Maker",
				background_color: "#44403c",
				theme_color: "#f59e0c",
				scope: "/",
				orientation: "portrait",
				start_url: "/",
				display: "standalone",
				icons: [
					{
						src: "/android-chrome-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/android-chrome-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
				],
			},
			workbox: {
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/api\.scryfall\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "scryfall-cache",
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: /^https:\/\/raw\.githubusercontent\.com\/*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "github-cache",
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: /\.(png|svg|jpg|jpeg)$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "assets-cache",
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
			},
		}),
	],
});
