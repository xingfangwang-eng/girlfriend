export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, model = 'fal-ai/fast-sdxl' } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const FAL_API_KEY = process.env.FAL_API_KEY;
    const FAL_API_URL = `https://fal.run/${model}`;

    if (!FAL_API_KEY) {
        console.error('FAL_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const response = await fetch(FAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`
            },
            body: JSON.stringify({
                prompt: prompt,
                image_size: 'square_hd',
                num_inference_steps: 25,
                guidance_scale: 7.5,
                sync_mode: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('Fal.ai API error:', errorData || response.statusText);
            return res.status(response.status).json({ 
                error: errorData?.detail || 'API request failed' 
            });
        }

        const data = await response.json();
        const imageUrl = data.images?.[0] || data.image_url;

        if (!imageUrl) {
            return res.status(500).json({ error: 'No image returned from API' });
        }

        return res.status(200).json({ image_url: imageUrl });

    } catch (error) {
        console.error('Error calling Fal.ai API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}