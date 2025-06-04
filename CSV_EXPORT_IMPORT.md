# CSV Export/Import Feature

## Overview
The AI Tab Manager now supports exporting and importing saved tabs in CSV format. This feature allows you to:
- Backup your saved tabs
- Share tab collections with others
- Migrate tabs between browsers or devices
- Bulk import tabs from other sources

## Export Feature

### How to Export
1. Click on the "Saved" tab in the extension
2. Click the download icon (↓) in the top toolbar
3. A CSV file will be downloaded with the format: `saved_tabs_YYYY-MM-DD.csv`

### Export Format
The exported CSV contains the following columns:
- **Title**: The page title
- **URL**: The full URL of the page
- **Domain**: The domain name (e.g., www.google.com)
- **Category**: Either "Important" or "Save for Later"
- **Saved Date**: The date when the tab was saved
- **Saved Time**: The time when the tab was saved

### Example Export
```csv
Title,URL,Domain,Category,Saved Date,Saved Time
"Google Search","https://www.google.com","www.google.com","Important","1/15/2025","10:30:00 AM"
"Stack Overflow - Python Question","https://stackoverflow.com/questions/123456","stackoverflow.com","Save for Later","1/14/2025","3:45:00 PM"
```

## Import Feature

### How to Import
1. Click on the "Saved" tab in the extension
2. Click the upload icon (↑) in the top toolbar
3. Select a CSV file from your computer
4. Review the import preview and confirm

### Import Requirements
- CSV must have at least "Title" and "URL" columns
- Other columns are optional and will be auto-populated if missing
- Duplicate URLs (already in your saved tabs) will be skipped

### Automatic Features
1. **Duplicate Detection**: URLs that already exist in your saved tabs will not be imported
2. **Domain Extraction**: If the Domain column is missing, it will be extracted from the URL
3. **Date Defaulting**: If the date is missing, the current date/time will be used
4. **AI Categorization**: If the Category column is missing or empty:
   - Tabs will be automatically categorized using your configured AI provider
   - Requires a valid API key in settings
   - If AI categorization fails, tabs default to "Save for Later"

### Import Preview
Before importing, you'll see:
- Total number of tabs in the CSV
- Number of new tabs to be imported
- Number of duplicates to be skipped
- Whether AI categorization will be used

### Sample Import File
See `sample_import.csv` for an example of the expected format. Key points:
- Quotes are optional but recommended for fields with commas
- Category can be: "Important", "Save for Later", or empty
- Date format is flexible (most common formats are recognized)
- Missing fields can be left empty

## Tips and Best Practices

1. **Regular Backups**: Export your tabs regularly to maintain backups
2. **Clean URLs**: Ensure URLs in import files are complete (include http:// or https://)
3. **Category Names**: Use exact category names ("Important" or "Save for Later") for best results
4. **Large Imports**: For files with 100+ tabs, the AI categorization may take a few moments
5. **CSV Editing**: You can edit exported CSVs in Excel, Google Sheets, or any text editor

## Troubleshooting

### Common Issues
1. **"CSV must contain headers"**: Ensure your file has a header row with column names
2. **"CSV must contain Title and URL columns"**: These are required columns
3. **No tabs imported**: Check if all URLs already exist in your saved tabs
4. **AI categorization failed**: Ensure you have a valid API key configured in settings

### CSV Format Issues
- Use UTF-8 encoding for files with special characters
- Escape quotes in fields by doubling them: `"Title with ""quotes"" in it"`
- Fields with commas should be wrapped in quotes