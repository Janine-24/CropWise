# 🌱 CropWise

### Turning NASA Earth Data into Smarter Farming Decisions

CropWise is a web-based agricultural decision-support platform developed for the **NASA Space Apps Challenge 2026**, under the challenge **Field Shift: Adapting Farms with NASA Data**.

Our goal is to help farmers make more informed decisions by turning NASA climate data and weather information into practical farming recommendations.

Instead of simply displaying environmental data, CropWise helps users understand their farm conditions, explore suitable crops, plan crop rotations, identify potential risks, and track farming actions.

## What Can CropWise Do?

### 🗺️ Interactive Farm Mapping

Users can locate their farms through an interactive map, select agricultural fields, or manually enter coordinates.

For our Iowa demonstration area, CropWise uses USDA agricultural parcel data to display mapped field boundaries. Users outside this region can still select their location using geographic coordinates.

The application is designed to support managing up to five fields.

### 🌦️ Weather Forecast

CropWise integrates NOAA National Weather Service and Open-Meteo to provide weather forecasts.

Users can explore hourly and seven-day forecasts, including temperature, precipitation probability, wind conditions, and rainfall information where available.

The application supports international locations through Open-Meteo, with NOAA used for supported US locations.

### 🌾 Crop Recommendations

Using historical climate information from NASA POWER, CropWise evaluates 12 potential crops based on factors such as:

- Temperature and rainfall patterns
- Current crop
- Soil pH
- Irrigation availability
- Farmer preferences

The recommendations are generated through a rule-based evaluation system designed to make the reasoning easier to understand.

### 📊 Decision Planner

CropWise generates four crop rotation strategies to help farmers compare different approaches to agricultural planning.

Users can explore trade-offs involving crop diversification, farming priorities, and environmental risks.

These strategies are intended as planning guidance rather than guaranteed predictions of yields or profits.

### ⚠️ Risk Management

CropWise combines available weather forecasts, historical climate data, and user-provided farm information to identify potential agricultural risks.

Each assessment includes a severity level, supporting information, and suggested actions.

The application distinguishes between weather-related risks, historical climate constraints, and farm-specific conditions.

### 📋 Action Tracking & Reports

Farmers can record completed actions, add notes, and review their activity history.

The Reports & History page helps users keep track of decisions and interventions over time.

Recording an action does not automatically mean that the underlying environmental risk has been resolved.

### 🚜 Farm Management

Users can configure farm details such as location, current crops, soil pH, irrigation availability, and farming goals.

These settings help personalize Crop Recommendations, Decision Planner, and Risk Management.

## NASA Resources Used

Our main NASA resource is **NASA POWER (Prediction Of Worldwide Energy Resources)**.

We use two historical climate parameters:

| Parameter | Description | Purpose |
|---|---|---|
| T2M | Temperature at 2 Meters | Understanding temperature patterns and crop suitability |
| PRECTOTCORR | Precipitation Corrected | Understanding rainfall patterns and climate-related constraints |

NASA POWER provides historical climate data, not live weather measurements.

Official links:

- NASA POWER: https://power.larc.nasa.gov/
- NASA POWER Data Access Viewer: https://power.larc.nasa.gov/data-access-viewer/
- NASA POWER Daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/

## Other Data Sources

- **NOAA National Weather Service:** https://www.weather.gov/
- **Open-Meteo:** https://open-meteo.com/
- **USDA National Agricultural Statistics Service:** https://www.nass.usda.gov/
- **OpenStreetMap:** https://www.openstreetmap.org/

USDA field boundaries are currently integrated for our Iowa demonstration region. We do not claim worldwide farm-boundary coverage.

## Technologies Used

| Technology | Purpose |
|---|---|
| React 18 | Frontend application |
| TypeScript | Application logic and type safety |
| Vite | Development and build tooling |
| Tailwind CSS | Responsive user interface |
| Leaflet / React-Leaflet | Interactive mapping |
| NASA POWER API | Historical climate information |
| NOAA / Open-Meteo APIs | Weather forecasts |
| GeoJSON | Agricultural field boundary data |
| localStorage | Farm settings and action history |

The current prototype runs primarily in the browser and does not require users to create accounts.

## Getting Started

### Prerequisites

Make sure you have Node.js and npm installed.

### Installation

Clone the repository:

```bash
git clone https://github.com/Janine-24/CropWise.git
cd CropWise/agridash-interactive-project
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in your terminal.

To create a production build:

```bash
npm run build
```

## How to Use CropWise

1. Open the application and select or enter your farm location.
2. Configure your farm details, including crops, soil pH, and irrigation.
3. Check the weather forecast for your selected location.
4. Explore Crop Recommendations based on NASA historical climate data.
5. Compare farming strategies using Decision Planner.
6. Review potential environmental risks and suggested actions.
7. Record completed actions and review your history in Reports & History.

CropWise also includes demonstration data so users can explore the platform without having their own farm information.

## Current Limitations

CropWise is a hackathon prototype and is not a replacement for professional agricultural advice.

Some limitations include:

- Crop recommendations are based on transparent rules rather than a validated crop-yield prediction model.
- Soil pH and irrigation information are provided by users, not measured by connected sensors.
- Detailed agricultural parcel boundaries are available only in supported regions.
- Weather forecasts are predictions and can change as providers update their data.
- Farm configurations and action records are stored locally in the browser rather than synchronized through a cloud account.
- The current version does not directly integrate real-time field sensors or measure field-level soil moisture.

We hope to expand the platform with more NASA Earth observation datasets and improved agricultural modelling in the future.

## AI Assistance Disclosure

We used AI tools, including ChatGPT and Google Antigravity, to assist with brainstorming, interface development, code generation, debugging, testing, and documentation.

Our team defined the project goals, selected the data sources, made design decisions, and guided the development process.

AI-assisted code and documentation are part of this prototype. However, the environmental data displayed by CropWise is intended to come from the identified external data providers, not AI-generated measurements.

This acknowledgement is included to clearly disclose our use of AI-assisted development tools.

## Our Goal

We believe that environmental data should be useful beyond research and scientific applications.

With CropWise, we wanted to show how NASA Earth science data can help farmers better understand their land, prepare for changing conditions, and make more informed agricultural decisions.

**From Earth observation to better decisions on the ground.**

---

Developed for the NASA Space Apps Challenge 2026.
