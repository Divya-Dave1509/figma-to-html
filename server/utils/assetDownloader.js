const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Recursively finds all nodes that have image fills
 * @param {Object} node - The Figma node to traverse
 * @param {Array} images - Accumulator for image nodes
 * @returns {Array} - Array of objects { id, name }
 */
const extractImageNodes = (node, images = []) => {
    if (!node) return images;

    // Check for image fills
    if (node.fills && Array.isArray(node.fills)) {
        const hasImage = node.fills.some(fill => fill.type === 'IMAGE' && fill.visible !== false);
        if (hasImage) {
            images.push({
                id: node.id,
                name: node.name
            });
        }
    }

    // Recursively check children
    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => extractImageNodes(child, images));
    }

    return images;
};

/**
 * Downloads images from Figma and saves them locally
 * @param {string} fileKey - The Figma file key
 * @param {Array} nodes - Array of image nodes { id, name }
 * @param {string} customFolderName - Optional custom name for the folder
 * @param {string} figmaToken - Figma access token
 * @returns {Object} - Map of nodeID -> localPath
 */
const downloadAssets = async (fileKey, nodes, figmaToken, customFolderName = null) => {
    if (!nodes || nodes.length === 0) return {};

    const imageMap = {};
    const ids = nodes.map(n => n.id).join(',');

    try {
        console.log(`Fetching download URLs for ${nodes.length} images...`);

        // 1. Get Image URLs from Figma
        // 1. Get Image URLs from Figma with Retry Logic
        const fetchImages = async (retries = 3) => {
            try {
                return await axios.get(`https://api.figma.com/v1/images/${fileKey}`, {
                    headers: { 'X-Figma-Token': figmaToken },
                    params: {
                        ids: ids,
                        format: 'png',
                        scale: 2,
                        use_absolute_bounds: true
                    }
                });
            } catch (err) {
                if (err.response && err.response.status === 429 && retries > 0) {
                    const waitTime = (4 - retries) * 10000; // 10s, 20s, 30s
                    console.warn(`[AssetDownloader] Rate limit handling: Waiting ${waitTime / 1000}s...`);
                    await new Promise(r => setTimeout(r, waitTime));
                    return fetchImages(retries - 1);
                }
                throw err;
            }
        };

        const response = await fetchImages();

        const urls = response.data.images;
        if (!urls) return {};

        // 2. Prepare local directory
        // We'll save to client/public/assets/images/[customFolderName OR fileKey]
        // This makes them accessible via http://localhost:5173/assets/images/...

        // Sanitize the folder name if provided
        const safeFolderName = customFolderName
            ? customFolderName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            : fileKey;

        const assetsDir = path.join(__dirname, '../../client/public/assets/images', safeFolderName);

        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // 3. Download each image
        const downloads = Object.entries(urls).map(async ([id, url]) => {
            if (!url) return;

            try {
                const imageResp = await axios.get(url, { responseType: 'arraybuffer' });

                // Sanitize ID for filename (replace : with -)
                const safeId = id.replace(/:/g, '-');
                const filename = `${safeId}.png`;
                const localPath = path.join(assetsDir, filename);

                fs.writeFileSync(localPath, imageResp.data);

                // Store the public URL path
                // Note: In Vite, files in public/ are served at root
                // So public/assets/images/... becomes /assets/images/...
                imageMap[id] = `/assets/images/${safeFolderName}/${filename}`;

                console.log(`Downloaded image for node ${id}`);
            } catch (err) {
                console.error(`Failed to download image for node ${id}:`, err.message);
            }
        });

        await Promise.all(downloads);

        return imageMap;

    } catch (error) {
        console.error('Error in downloadAssets:', error.message);
        return {};
    }
};

module.exports = {
    extractImageNodes,
    downloadAssets
};
