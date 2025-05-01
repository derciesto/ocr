import express from 'express';
import bodyParser from 'body-parser';
import { TextractClient, AnalyzeIDCommand } from '@aws-sdk/client-textract';
import { Buffer } from 'buffer';
import path from "path"
import { join, dirname } from 'path';

import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.resolve();
const app = express();
const port = 3001;
const publicFolderPath = path.join(__dirname, "public");
app.use(express.static(publicFolderPath));
// Middleware
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for large images

// Initialize Textract Client
const client = new TextractClient({
  region: 'us-east-1', credentials: {
    accessKeyId: "AKIA6GBMBFOGY5WNZZWW",
    secretAccessKey: "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"
  }
});

app.get('/', (req, res) => {
  res.send('Hello, 3001!');
});
app.get('/image', function (req, res) {
  res.sendFile(__dirname + '/image.html');
});
app.get('/image-flow', function (req, res) {
  res.sendFile(__dirname + '/image-flow.html');
});
app.use('/static', express.static(publicFolderPath));


// Route to handle image upload
app.post('/upload', async (req, res) => {
  try {

    // Save Image First 
    const base64String = req.body.image // Remove Base64 prefix

    // Extract the actual Base64 data and file extension
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error("Invalid Base64 format");
      process.exit(1);
    }

    const mimeType = matches[1]; // Example: image/png
    const base64Data = matches[2]; // Actual Base64 content
    const extension = mimeType.split("/")[1]; // Example: png

    // Define the file path in the public folder
    const fileName = `image_${Date.now()}.${extension}`;
    const filePath = join(__dirname, 'public', fileName);

    try {
      // Convert Base64 to Buffer and save it
      await writeFile(filePath, Buffer.from(base64Data, 'base64'));
      console.log("File saved successfully:", filePath);
    } catch (err) {
      console.error("Error saving the file:", err);
    }
    // End Up Here


    const base64Image = req.body.image.replace(/^data:image\/png;base64,/, ''); // Remove Base64 prefix
    const imageBuffer = Buffer.from(base64Image, 'base64');

    // Prepare Textract parameters
    const params = {
      DocumentPages: [
        {
          Bytes: imageBuffer,
        },
      ],
    };

    // Call AWS Textract
    const command = new AnalyzeIDCommand(params);
    const response = await client.send(command);

    // Extract identity document fields
    const fields = response.IdentityDocuments?.[0]?.IdentityDocumentFields || [];
    const extractedData = {};

    fields.forEach((field) => {
      if (field.Type?.Text && field.ValueDetection?.Text) {
        extractedData[field.Type.Text] = field.ValueDetection.Text;
      }
    });

    const name = extractedData['Name'] || 'Name not found';
    const address = extractedData['Address'] || 'Address not found';

    // Respond to the client
    res.json({ extractedData });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
