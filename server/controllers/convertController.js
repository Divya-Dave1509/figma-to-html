const axios = require('axios');
const fs = require('fs');
const { parseFigmaNode } = require('../utils/figmaParser');
const { detectComponents } = require('../utils/componentDetector');
const { extractImageNodes, downloadAssets } = require('../utils/assetDownloader');
const generatePrompt = (mode, customCSS = '') => {
    const basePrompt = `
    You are an expert Frontend Developer specializing in converting designs into pixel-perfect, responsive HTML and CSS.
    
    **CRITICAL INSTRUCTION - ANTI-HALLUCINATION:**
    The provided image is the **SINGLE SOURCE OF TRUTH**. 
    - **ZERO CREATIVITY:** Do NOT add *anything* that is not explicitly visible in the image.
    - **NO GENERIC SECTIONS:** Do NOT add "Hero Sections", "Feature Cards", "Testimonials", or "Footers" unless they are actually in the image.
    - **NO LOREM IPSUM:** Do NOT use placeholder text. Only use the text visible in the image.
    - **NO INVENTED CONTENT:** If the image only has a title and a logo, your code should ONLY have a title and a logo. Do not "fill in the blanks".
    - **REPLICATE** the layout, spacing, colors, and typography **EXACTLY** as seen in the image.

    **GOAL:** 
    Analyze the provided image and generate production-ready code that visually matches the design as closely as possible.

    **VISUAL ANALYSIS (INTERNAL STEP):**
    1.  **Analyze Layout:** Identify the main structure (e.g., header, hero section, features grid, footer). Is it single-column or multi-column? Match the *exact* arrangement.
    2.  **Analyze Colors:** Extract the *exact* hex codes for backgrounds, text, and buttons.
    3.  **Analyze Typography:** Notice font sizes, weights (bold/regular), alignment, and **Line Heights**.
    4.  **Analyze Content:** Read the text in the image and use it verbatim.
    
    **CRITICAL: USE EXTRACTED DATA**
    If **DIRECT FIGMA DATA** is provided at the end of this prompt, you **MUST** use those exact values for:
    - **Font Families:** Use the specific font family names listed (e.g. 'Gilroy', 'Inter'). **DO NOT DEFAULT TO ARIAL OR SYSTEM FONTS** unless the design actually uses them.
      - If a custom font is used (e.g. "Gilroy"), use it in the CSS variable: \`--font-family-heading: 'Gilroy', sans-serif;\`.
      - **CRITICAL:** Add a Google Fonts import or @font-face placeholder for these fonts in the CSS so they usually work.
    - **Font Sizes/Weights:** Match the exact pixel values from the JSON data.
    - **Colors:** Use the exact hex codes provided in the JSON data.
    - **Line Heights:** Use the specific line-heights provided.
    **Visual estimation is secondary to this direct data.**

    **OUTPUT FORMAT:**
    - Return **ONLY** the code.
    - Start with \`\`\`html\` and end with \`\`\`.
    - The HTML should be a complete file including \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\` (with embedded \`<style>\`), and \`<body>\`.
    - Do not add any conversational text or explanations.

    ${customCSS ? `
    **USER PROVIDED CUSTOM CSS / UTILITIES:**
    The user has provided the following CSS/Utility classes. **YOU MUST PRIORITIZE THESE:**
    \`\`\`css
    ${customCSS}
    \`\`\`
    **INSTRUCTIONS FOR CUSTOM CSS:**
    1.  **Analyze the provided CSS** above. Look for class names, variables (colors, fonts), and utility patterns.
    2.  **USE THESE CLASSES:** If the provided CSS contains classes that match the design (e.g., \`.text-primary\`, \`.btn-lg\`, \`.flex-center\`), use them in your HTML *instead* of writing new CSS.
    3.  **USE VARIABLES:** If the provided CSS defines variables (e.g., \`--primary: #006699\`), use them!
    4.  **FALLBACK:** If the provided CSS does *not* cover a specific style (e.g., a specific padding or a unique card layout), generate your own CSS for that part as usual.
    5.  **MERGE:** You can mix provided utility classes with generated custom classes if needed.
    ` : ''}
    `;

    if (mode === 'email') {
        return `
      ${basePrompt}
      **MODE: EMAIL TEMPLATE (STRICT COMPATIBILITY)**
      
      **CODING STANDARDS:**
      1.  **Structure:** 
          - Use **TABLES** (\`<table>\`, \`<tr>\`, \`<td>\`) for ALL layout.
          - **FORBIDDEN:** Do NOT use Flexbox (\`display: flex\`) or Grid (\`display: grid\`).
          - Use \`width="100%"\` for main containers.
          - Use \`cellpadding="0"\` and \`cellspacing="0"\` on all tables.
          - Use \`border="0"\` on all tables.
      2.  **CSS:** 
          - Use **INLINE CSS** for ALL styling (e.g., \`<td style="color: red; padding: 20px;">\`).
          - Do NOT use \`<style>\` blocks in the head for core layout (some clients strip them).
          - Use \`font-family: sans-serif;\` as a fallback.
      3.  **Responsiveness:**
          - Use \`max-width: 600px\` for the main container table to ensure readability on desktop.
          - Use fluid widths (percentages) for inner columns where possible.
      4.  **Images:**
          - Always include \`alt\` text.
          - Use \`display: block;\` style on images to remove bottom spacing gaps.
          - **CRITICAL:** Add \`max-width: 100%; height: auto;\` to prevent overflow.
    `;
    } else {
        // Web mode
        return `
      ${basePrompt}
      **MODE: MODERN WEB PAGE**

      **CODING STANDARDS:**
      1.  **HTML5:** 
          - **Single Wrapper:** Use ONE main container (e.g., \`<main>\`) to wrap the entire design.
          - **Container Class:** Inside the main wrapper, you **MUST** use a \`<div class="container">\` to center content.
          - Use \`<div>\` for internal layout containers.
      2.  **CSS:**
          - **Layout Engine:** Use **Flexbox** (\`display: flex\`) for ALL layouts.
          - **FORBIDDEN:** DO NOT use CSS Grid (\`display: grid\`).
          - **Container Style:** The \`.container\` class **MUST** have:
            - \`max-width: 1440px;\`
            - \`margin: 0 auto;\` (to center it)
            - \`padding-left: 20px;\`
            - \`padding-right: 20px;\`
            - \`width: 100%;\`
          - **Spacing:** **CRITICAL:** Use \`gap: 30px\` for all side-by-side Flexbox containers to prevent content from sticking together.
          - **Alignment:** Use \`justify-content\` and \`align-items\` to control spacing and alignment.
          - **CSS Variables (CRITICAL):** You **MUST** define and use variables in \`:root\` for **EVERY** design token:
            - **Colors:** \`--primary\`, \`--secondary\`, \`--bg\`, \`--text-main\`, \`--text-muted\`.
            - **Fonts:** \`--font-family-heading\`, \`--font-family-body\`.
            - **Typography:** \`--fs-xl\`, \`--fs-lg\`, \`--fs-md\`, \`--fs-sm\`.
            - **Line Heights:** \`--lh-tight\` (1.1-1.2), \`--lh-normal\` (1.5), \`--lh-loose\` (1.6-1.8).
            - **Spacing:** \`--spacing-xs\` (4-8px), \`--spacing-sm\` (12-16px), \`--spacing-md\` (24-32px), \`--spacing-lg\` (48-64px).
            - **Borders:** \`--radius-sm\`, \`--radius-md\`.
            - **Usage:** Do NOT use hardcoded values in the CSS (except 0 or 1px borders). ALWAYS use the variables.
          - **Reset:** Include a robust CSS reset: \`* { box-sizing: border-box; margin: 0; padding: 0; }\`.
          - **No External Libraries:** Use pure "Vanilla" CSS. No Bootstrap, Tailwind, or FontAwesome.
      3.  **Responsiveness:**
          - The design must be fully responsive.
          - **Desktop First:** Match the image exactly for desktop screens.
          - **Mobile:** Use media queries (\`@media (max-width: 768px)\`) to stack elements vertically (\`flex-direction: column\`). Ensure the \`gap: 30px\` (or appropriate vertical spacing) persists to keep elements separated.
      4.  **Images:**
          - Use placeholders: \`https://placehold.co/600x400\` (adjust dimensions as needed).
          - **CRITICAL - Responsive Images:** ALL images MUST have these CSS properties:
            - \`max-width: 100%;\`
            - \`height: auto;\`
            - \`display: block;\`
          - This prevents images from overflowing their containers and causing horizontal scroll.
      5.  **Text Content:**
          - **CRITICAL:** Transcribe the text from the image **EXACTLY** as it appears. Do not use "Lorem Ipsum" unless it is in the image.
    `;
    }
};

exports.convertImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const { mode, customCSS } = req.body; // 'web' or 'email', plus optional customCSS

        console.log(`Processing image upload: ${req.file.originalname}`);
        console.log(`File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Mime type: ${req.file.mimetype}`);

        const base64Image = req.file.buffer.toString('base64');
        const mediaType = req.file.mimetype;

        const prompt = generatePrompt(mode, customCSS);

        // Use OpenAI GPT-4o for vision
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mediaType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000 // 2 minutes timeout
        });

        // Extract text content using Regex to ignore conversational text
        const fullText = response.data.choices[0].message.content;
        const codeMatch = fullText.match(/```html([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : fullText;

        res.json({ html: code });

    } catch (error) {
        const errorLog = `[${new Date().toISOString()}] Image Error: ${error.message}\nStack: ${error.stack}\nOpenAI Error: ${JSON.stringify(error.response?.data || error)}\n\n`;
        fs.appendFileSync('server_error.log', errorLog);
        console.error('Error converting image:', error);

        const apiKey = process.env.OPENAI_API_KEY || '';
        const maskedKey = apiKey.length > 10 ? `${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}` : 'Not Set';

        res.status(500).json({ error: `Failed to convert image: ${error.response?.data?.error?.message || error.message}. (Using Key: ${maskedKey})` });
    }
};

exports.convertFigma = async (req, res) => {
    try {
        const { url, mode, customCSS } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'Figma URL is required' });
        }

        console.log(`Processing Figma URL: ${url}`);
        console.log(`Mode: ${mode}`);
        if (customCSS) console.log('Custom CSS provided (length):', customCSS.length);

        // 1. Parse URL to get file key and node id
        // Format: https://www.figma.com/file/FILE_KEY/title?node-id=NODE_ID
        const fileIdMatch = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
        const nodeIdMatch = url.match(/node-id=([^&]+)/);

        if (!fileIdMatch) {
            return res.status(400).json({ error: 'Invalid Figma URL format.' });
        }

        const fileKey = fileIdMatch[1];
        let nodeId = nodeIdMatch ? nodeIdMatch[1].replace(/%3A/g, ':') : null;

        if (nodeId && !nodeId.includes(':')) {
            nodeId = nodeId.replace(/-/g, ':');
        }

        console.log('Using File Key:', fileKey);
        console.log('Using Node ID:', nodeId);

        if (!nodeId) {
            return res.status(400).json({ error: 'Please provide a Figma URL pointing to a specific Frame (node-id).' });
        }

        const figmaToken = process.env.FIGMA_ACCESS_TOKEN;

        // 2. Fetch Node Data (Direct Design Data)
        console.log('Fetching Figma Node Data...');
        let designContext = '';
        let parsedDesign = null;
        let detectedComponents = null;
        try {
            const nodeResponse = await axios.get(`https://api.figma.com/v1/files/${fileKey}/nodes`, {
                headers: { 'X-Figma-Token': figmaToken },
                params: { ids: nodeId }
            });

            const nodeData = nodeResponse.data.nodes[nodeId]?.document;

            if (nodeData) {
                // LOGGING: Dump raw Figma data for debugging
                try {
                    fs.writeFileSync('figma_raw_data.json', JSON.stringify(nodeData, null, 2));
                    console.log('✅ Raw Figma data dumped to figma_raw_data.json');
                } catch (err) {
                    console.error('❌ Failed to dump raw Figma data:', err);
                }

                // Use the new FigmaParser to get a clean design system summary
                parsedDesign = parseFigmaNode(nodeData);

                // Detect components in the design
                detectedComponents = detectComponents(nodeData);

                // Extract and download image assets
                // Extract and download image assets
                try {
                    const imageNodes = extractImageNodes(nodeData);
                    let imageMap = {};
                    if (imageNodes.length > 0) {
                        console.log(`Found ${imageNodes.length} image nodes. Downloading...`);

                        // Use the section/node name for the folder (e.g. "Hero_Section")
                        const sectionName = nodeData.name;
                        imageMap = await downloadAssets(fileKey, imageNodes, figmaToken, sectionName);

                        // Inject local paths into nodeData for the AI to see directly
                        const injectLocalPaths = (node) => {
                            if (!node) return;
                            if (imageMap[node.id]) {
                                console.log(`✅ Injecting localSrc for node ${node.id}: ${imageMap[node.id]}`);
                                node.localSrc = imageMap[node.id];
                                // Also add a clear instruction property
                                node.AI_INSTRUCTION = `USE THIS IMAGE SOURCE: ${imageMap[node.id]}`;
                            }
                            if (node.children) {
                                node.children.forEach(injectLocalPaths);
                            }
                        };
                        injectLocalPaths(nodeData);

                        // LOGGING: Dump processed data to verify injection
                        try {
                            fs.writeFileSync('figma_processed_data.json', JSON.stringify(nodeData, null, 2));
                            console.log('✅ Processed Figma data (with injections) dumped to figma_processed_data.json');
                        } catch (err) {
                            console.error('❌ Failed to dump processed data:', err);
                        }
                    } else {
                        console.log('No image nodes found to download.');
                    }
                } catch (assetError) {
                    console.error('❌ Error processing image assets:', assetError);
                    // Continue without images if this fails
                }

                designContext = `
**EXTRACTED DESIGN SYSTEM (FROM FIGMA API):**
- **COLORS:** ${parsedDesign.colors.join(', ')}
- **DETECTED FONT FAMILIES:** ${parsedDesign.fonts ? [...new Set(parsedDesign.fonts.map(f => f.match(/Family: ([^,]+)/)?.[1] || ''))].filter(Boolean).join(', ') : 'None'}
- **GRADIENTS:** ${parsedDesign.gradients?.length > 0 ? parsedDesign.gradients.join(', ') : 'None'}
- **TYPOGRAPHY:** 
  - Headings: ${parsedDesign.typography?.headings && parsedDesign.typography.headings.length > 0 ? parsedDesign.typography.headings.join(' | ') : 'None'}
  - Body: ${parsedDesign.typography?.body && parsedDesign.typography.body.length > 0 ? parsedDesign.typography.body.join(' | ') : 'None'}
  - Captions: ${parsedDesign.typography?.captions && parsedDesign.typography.captions.length > 0 ? parsedDesign.typography.captions.join(' | ') : 'None'}
- **SPACING SCALE:** ${parsedDesign.spacingScale?.join(', ') || 'Not detected'}
- **BORDERS:**
  - Radius: ${parsedDesign.borders?.radius?.join(', ') || 'None'}
  - Widths: ${parsedDesign.borders?.widths?.join(', ') || 'None'}
- **EFFECTS:**
  - Shadows: ${parsedDesign.effects?.shadows?.length || 0} detected
  - Blurs: ${parsedDesign.effects?.blurs?.length || 0} detected
- **LAYOUT:**
  - Gaps: ${parsedDesign.layout.gaps.join(', ')}
  - Paddings: ${parsedDesign.layout.paddings.join(', ')}

**DETECTED COMPONENTS:**
- Buttons: ${detectedComponents.summary.buttonCount}
- Cards: ${detectedComponents.summary.cardCount}
- Navigation: ${detectedComponents.summary.navigationCount}
- Forms: ${detectedComponents.summary.formCount}
- Forms: ${detectedComponents.summary.formCount}
- Icons: ${detectedComponents.summary.iconCount}

**AVAILABLE LOCAL IMAGE ASSETS:**
${Object.entries(imageMap).map(([id, path]) => `- Node ${id}: ${path}`).join('\n') || 'None downloaded'}

**INSTRUCTION FOR IMAGES:**
The raw node structure below now contains "localSrc" and "AI_INSTRUCTION" fields for image nodes. 
YOU MUST USE THESE VALUES for the \`src\` attribute of <img> tags. 
DO NOT use placeholders if a "localSrc" is available.

**RAW NODE STRUCTURE (Partial):**
${JSON.stringify(nodeData, (key, value) => {
                    if (['id', 'name', 'type', 'characters', 'style', 'backgroundColor', 'fills', 'strokes', 'layoutMode', 'itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'localSrc', 'AI_INSTRUCTION'].includes(key)) {
                        return value;
                    }
                    if (key === 'children') return value;
                    return undefined;
                }, 2).substring(0, 5000)}
`;
            } else {
                console.warn(`Warning: Could not fetch node data for ID ${nodeId}. Proceeding with image only.`);
                designContext = "Node data unavailable.";
            }
        } catch (nodeError) {
            console.warn(`Warning: Failed to fetch node data: ${nodeError.message}. Proceeding with image only.`);
            designContext = "Node data unavailable.";
        }

        // 3. Download the image to send to Anthropic

        // Helper to delay
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Helper to fetch and check size with Retry Logic
        // Helper to fetch and check size with Retry Logic
        const fetchAndCheckImage = async (scale, retries = 10) => {
            try {
                console.log(`Attempting to fetch Figma image with scale: ${scale}... (Retries left: ${retries})`);
                const imgResp = await axios.get(`https://api.figma.com/v1/images/${fileKey}`, {
                    headers: { 'X-Figma-Token': figmaToken },
                    params: { ids: nodeId, format: 'png', scale: scale }
                });
                const imgUrl = imgResp.data.images[nodeId];
                if (!imgUrl) throw new Error('Could not generate image from Figma node.');

                const download = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                return { buffer: download.data, size: download.data.length };
            } catch (error) {
                // Handle Rate Limits (429)
                if (error.response && error.response.status === 429 && retries > 0) {
                    // Backoff: 10s, 20s, 30s... up to 60s max/wait
                    const attempt = 11 - retries; // 1, 2, 3...
                    const waitTime = Math.min(attempt * 10000, 60000);

                    console.warn(`Rate limit exceeded (429). Waiting ${waitTime / 1000}s... (${retries} retries left)`);
                    await delay(waitTime);
                    return fetchAndCheckImage(scale, retries - 1);
                }
                throw error;
            }
        };

        let imageBuffer;
        try {
            // Try Scale 2 first (High Quality)
            let result = await fetchAndCheckImage(2);

            // If > 3MB (safe limit for 5MB Base64), try Scale 1
            if (result.size > 3 * 1024 * 1024) {
                console.warn(`Image size ${result.size} bytes exceeds safe limit (3MB). Retrying with Scale 1...`);
                await delay(1000); // Wait 1s to avoid rate limits
                result = await fetchAndCheckImage(1);
            }

            // If still > 3MB, try Scale 0.5
            if (result.size > 3 * 1024 * 1024) {
                console.warn(`Image size ${result.size} bytes still exceeds safe limit (3MB). Retrying with Scale 0.5...`);
                await delay(1000); // Wait 1s
                result = await fetchAndCheckImage(0.5);
            }

            imageBuffer = result.buffer;
        } catch (imgError) {
            console.error('Failed to download image:', imgError);
            const errMsg = imgError.response?.data?.err || imgError.message;
            const errorLog = `[${new Date().toISOString()}] Figma Image Download Error: ${errMsg}\nStack: ${imgError.stack}\n\n`;
            fs.appendFileSync('server_error.log', errorLog);
            return res.status(500).json({ error: `Failed to download image from Figma: ${errMsg}` });
        }

        const base64Image = Buffer.from(imageBuffer, 'binary').toString('base64');
        const mediaType = 'image/png';

        // 4. Send to OpenAI with Enhanced Context
        let prompt = generatePrompt(mode, customCSS);
        if (designContext && designContext !== "Node data unavailable.") {
            prompt += `\n\n**DIRECT FIGMA DATA (JSON):**\nUse this JSON data to get EXACT text content, colors, and layout structure. Prioritize this data for accuracy:\n\`\`\`json\n${designContext.substring(0, 15000)}\n\`\`\``;
        }

        // Use OpenAI GPT-4o for vision
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mediaType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Extract text content using Regex to ignore conversational text
        const fullText = response.data.choices[0].message.content;
        const codeMatch = fullText.match(/```html([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : fullText;

        res.json({
            html: code,
            designTokens: parsedDesign,
            components: detectedComponents
        });

    } catch (error) {
        const apiError = error.response?.data;
        const errorMessage = apiError
            ? (apiError.err || apiError.message || JSON.stringify(apiError))
            : error.message;

        const errorLog = `[${new Date().toISOString()}] Figma Error: ${errorMessage}\nURL: ${req.body.url}\nStack: ${error.stack}\nFull Details: ${JSON.stringify(apiError)}\n\n`;
        fs.appendFileSync('server_error.log', errorLog);

        console.error('Error converting Figma:', error);
        console.error('Figma/Anthropic API Error Details:', JSON.stringify(apiError));

        const apiKey = process.env.ANTHROPIC_API_KEY || '';
        const maskedKey = apiKey.length > 10 ? `${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}` : 'Not Set';

        res.status(500).json({ error: `Failed to convert Figma design: ${errorMessage}. (Using Key: ${maskedKey})` });
    }
};

exports.refineCode = async (req, res) => {
    try {
        const { code, prompt } = req.body;

        if (!code || !prompt) {
            return res.status(400).json({ error: 'Missing code or prompt' });
        }

        const systemPrompt = `
    You are an expert Frontend Developer.
    Your task is to UPDATE the provided HTML/CSS code based on the user's request.
    
    **INSTRUCTIONS:**
    1.  **Analyze** the "Current Code" and the "User Request".
    2.  **Apply** the requested changes strictly.
    3.  **Maintain** the existing coding standards (Flexbox, CSS Variables, BEM, etc.).
    4.  **Return** the COMPLETE, updated HTML file. Do not return partial snippets.
    5.  **Output Format:** Return **ONLY** the code block wrapped in \`\`\`html\`\`\`. No conversational text.
    `;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: `
**CURRENT CODE:**
\`\`\`html
${code}
\`\`\`

**USER REQUEST:**
${prompt}

**UPDATED CODE:**
`
                }
            ],
            max_tokens: 4096
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Extract text content using Regex
        const fullText = response.data.choices[0].message.content;
        const codeMatch = fullText.match(/```html([\s\S]*?)```/);
        const updatedCode = codeMatch ? codeMatch[1].trim() : fullText;

        res.json({ html: updatedCode });

    } catch (error) {
        console.error('Error refining code:', error);
        const apiKey = process.env.OPENAI_API_KEY || '';
        const maskedKey = apiKey.length > 10 ? `${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}` : 'Not Set';
        res.status(500).json({ error: `Failed to refine code: ${error.message}. (Using Key: ${maskedKey})` });
    }
};
