<h1 align = "center> Parabug Estimate Solutions Tool </h1><br>
<p align = "center">
  <img src = "https://imgur.com/7zsRApl.jpg" width = "450" />
 </p>

<https://parabug.xyz/>

## Table of Contents

- [Introduction](#introduction)
- [Usage](#usage)
- [Contributors](#contributors)
- [Acknowledgements](#acknowledgements)

## Introduction

The Parabug Estimate Solution Tool was designed to streamline contact information and preliminary data directly from the client to the company. Built with NodeJS and Javascript, it can be used on both mobile and desktop platforms.

## Usage

### Local development

Requires Node.js 26.13.0 and npm 12.2.2. With nvm installed:

```powershell
nvm install 26.13.0
nvm use 26.13.0
npm install
$env:GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"
npm start
```

Open <http://localhost:3000>. The Maps key must allow the local origin `http://localhost:3000`. PDF reports are generated with PdfMake. Estimate submissions support drawn areas with KML/CSV attachments or an uploaded PNG, JPEG, or PDF ranch map. Email submissions require valid OAuth credentials in `private/key.json`; keep that file private and out of source control.

## Contributors

 + [Christopher Williams](https://github.com/ChristopherLeeWilliams)
 + [Christian Martinez](https://github.com/chrisumartinez)
 + [Shaikh Sultani](https://github.com/shsultani)

## Acknowledgements

We would like to thank Chandler Bennett and Parabug for their support!
