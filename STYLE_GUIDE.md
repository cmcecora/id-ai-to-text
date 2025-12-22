# Whelp Design System Style Guide

A comprehensive style guide for the Whelp landing page design system. This document provides detailed specifications for maintaining visual consistency across the application.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing System](#4-spacing-system)
5. [Component Styles](#5-component-styles)
6. [Shadows and Elevation](#6-shadows-and-elevation)
7. [Animations and Transitions](#7-animations-and-transitions)
8. [Border Radius](#8-border-radius)
9. [Opacity and Transparency](#9-opacity-and-transparency)
10. [Layout System](#10-layout-system)
11. [Iconography](#11-iconography)
12. [Common Tailwind CSS Usage](#12-common-tailwind-css-usage)
13. [Example Component Reference Code](#13-example-component-reference-code)
14. [Accessibility Guidelines](#14-accessibility-guidelines)
15. [Responsive Design](#15-responsive-design)

---

## 1. Overview

### Design Philosophy

The Whelp design system follows a **warm, professional, and approachable** aesthetic. Key principles:

- **Warmth**: Cream/beige main background (`#fefbf6`) creates an inviting atmosphere
- **Clarity**: Strong typographic hierarchy with clear visual separation
- **Softness**: Generous border-radius and subtle shadows
- **Color Harmony**: Cohesive multi-hue palette with consistent tonal values
- **Whitespace**: Generous padding and margins for breathing room

### Design Tokens Structure

```
├── Colors (11 color families × 11 shades each)
├── Typography (1 font family, 5 weights)
├── Spacing (4px base unit)
├── Border Radius (4 sizes)
├── Shadows (4 elevation levels)
└── Transitions (standard 0.2s ease)
```

### Theme Mode

The system uses a **light theme** by default, indicated by the `html.light` class. CSS custom properties enable easy theme switching.

---

## 2. Color Palette

### 2.1 Brand Colors

| Role | Variable | Hex Value | Usage |
|------|----------|-----------|-------|
| **Main Background** | `--main` | `#fefbf6` | Page background, warm cream |
| **Footer Background** | `--footer-bg` | `#f5f4ef` | Footer sections |
| **Primary Text** | `--text` | `#000000` | Headlines, body text |
| **Secondary Text** | `--subtext` | `#555f68` | Descriptions, captions |
| **Primary Action** | `--wh-blue-50` | `#0f82e6` | Primary buttons, links |
| **Success/Online** | `--wh-green-50` | `#1b985b` | Status indicators |
| **Accent Purple** | `--wh-purple-80` | `#7112a1` | Hero sections, gradients |

### 2.2 Full Color Scales

Each color family has 11 shades (0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100) ranging from lightest to darkest.

#### Red Scale
```css
--wh-red-0: #fdf1f1;   /* Lightest - backgrounds */
--wh-red-5: #fce3e3;
--wh-red-10: #fad1d1;
--wh-red-20: #f8bfbf;
--wh-red-30: #f39595;
--wh-red-40: #ef6c6c;
--wh-red-50: #ea4343;  /* Base - primary use */
--wh-red-60: #e61919;
--wh-red-70: #bc1515;
--wh-red-80: #931010;
--wh-red-90: #6a0c0c;
--wh-red-100: #530909; /* Darkest */
```

#### Orange Scale
```css
--wh-orange-0: #fdf3ed;
--wh-orange-5: #fae4d6;
--wh-orange-10: #f8d6bf;  /* Avatar gradients */
--wh-orange-20: #f5c4a3;  /* Avatar gradients */
--wh-orange-30: #efa06c;
--wh-orange-40: #e9803a;  /* Avatar gradients */
--wh-orange-50: #cf6017;
--wh-orange-60: #bc5815;
--wh-orange-70: #974711;
--wh-orange-80: #73360d;
--wh-orange-90: #532709;
--wh-orange-100: #452008;
```

#### Yellow Scale
```css
--wh-yellow-0: #fdf4e2;
--wh-yellow-5: #fbe7c1;
--wh-yellow-10: #f9d99f;
--wh-yellow-20: #f6c974;
--wh-yellow-30: #f0a314;
--wh-yellow-40: #ce8b0d;  /* Status dots */
--wh-yellow-50: #b1770b;
--wh-yellow-60: #9e6a0a;
--wh-yellow-70: #815708;
--wh-yellow-80: #604006;
--wh-yellow-90: #483005;
--wh-yellow-100: #3a2704;
```

#### Green Scale
```css
--wh-green-0: #e5faf0;   /* Section backgrounds */
--wh-green-5: #c7f5df;
--wh-green-10: #a4efcb;  /* Icon backgrounds */
--wh-green-20: #70e6ad;
--wh-green-30: #22c375;  /* Avatar gradients */
--wh-green-40: #1fad68;  /* Status dots */
--wh-green-50: #1b985b;  /* Online status text */
--wh-green-60: #188651;
--wh-green-70: #147144;
--wh-green-80: #0f5232;
--wh-green-90: #0b3d25;
--wh-green-100: #08301d;
```

#### Blue Scale (Primary)
```css
--wh-blue-0: #ecf5fe;
--wh-blue-5: #d9ecfd;
--wh-blue-10: #c1e0fb;   /* Icon backgrounds */
--wh-blue-20: #a4d1f9;   /* Chart gradients */
--wh-blue-30: #66b2f5;
--wh-blue-40: #3a9df2;   /* Chart gradients, status dots */
--wh-blue-50: #0f82e6;   /* PRIMARY - buttons, links */
--wh-blue-60: #0d77d3;   /* Hover state */
--wh-blue-70: #0b61ad;
--wh-blue-80: #084981;
--wh-blue-90: #063660;
--wh-blue-100: #052b4d;
```

#### Purple Scale (Accent)
```css
--wh-purple-0: #f9f1fd;  /* Section backgrounds */
--wh-purple-5: #f4e3fc;  /* Section backgrounds */
--wh-purple-10: #ecd1fa; /* Icon backgrounds, blob gradients */
--wh-purple-20: #e5bff8; /* Avatar backgrounds */
--wh-purple-30: #d495f3; /* Avatar gradients */
--wh-purple-40: #c775f0; /* Avatar gradients, status dots */
--wh-purple-50: #b64ceb;
--wh-purple-60: #af3ae9;
--wh-purple-70: #9117cf; /* Avatar gradients */
--wh-purple-80: #7112a1; /* Hero gradient start */
--wh-purple-90: #540d77; /* Hero gradient end */
--wh-purple-100: #410a5c;
```

#### Pink Scale
```css
--wh-pink-0: #fdf1f6;
--wh-pink-5: #fce3ec;
--wh-pink-10: #fad1df;
--wh-pink-20: #f8bfd3;
--wh-pink-30: #f391b3;
--wh-pink-40: #ee6897;
--wh-pink-50: #e93a77;
--wh-pink-60: #e1195f;
--wh-pink-70: #b8144e;
--wh-pink-80: #8e103c;
--wh-pink-90: #6a0c2d;
--wh-pink-100: #530909;
```

#### Steel Scale (Cool Grays)
```css
--wh-steel-0: #f4f5f6;
--wh-steel-5: #e9ebed;
--wh-steel-10: #dbdee1;
--wh-steel-20: #cacfd3;
--wh-steel-30: #a8b0b8;
--wh-steel-40: #949fa8;
--wh-steel-50: #788591;
--wh-steel-60: #6a7681;
--wh-steel-70: #555f68;  /* SUBTEXT - descriptions */
--wh-steel-80: #40484f;
--wh-steel-90: #30363b;
--wh-steel-100: #25292d;
```

#### Neutral Scale (Pure Grays)
```css
--wh-neutral-0: #fafafa;
--wh-neutral-5: #f5f5f5;  /* Section backgrounds */
--wh-neutral-10: #f0f0f0;
--wh-neutral-20: #ebebeb; /* Borders, dividers */
--wh-neutral-30: #dbdbdb; /* Input borders */
--wh-neutral-40: #bfbfbf;
--wh-neutral-50: #8a8a8a;
--wh-neutral-60: #5c5c5c;
--wh-neutral-70: #404040;
--wh-neutral-80: #1f1f1f;
--wh-neutral-90: #1c1c1c; /* Button hover */
--wh-neutral-100: #141414;

--wh-black: #000000;
--wh-white: #ffffff;
```

### 2.3 Semantic Color Usage

| Context | Color Variable | Example |
|---------|---------------|---------|
| Primary Action | `--wh-blue-50` | Buttons, links |
| Primary Hover | `--wh-blue-60` | Button hover state |
| Success/Active | `--wh-green-40` to `--wh-green-50` | Online status |
| Warning | `--wh-yellow-40` | Caution indicators |
| Error | `--wh-red-50` | Error states |
| Muted Text | `--wh-steel-70` | Descriptions, timestamps |
| Borders | `--wh-neutral-20` to `--wh-neutral-30` | Dividers, input borders |
| Card Background | `--wh-white` | Cards on cream background |
| Section Accent | `--wh-purple-0` to `--wh-purple-5` | Feature sections |
| Section Accent Alt | `--wh-green-0` | Integrations section |

### 2.4 Gradient Definitions

```css
/* Hero background blob */
background: linear-gradient(135deg, var(--wh-purple-10) 0%, var(--wh-orange-10) 100%);

/* Why Whelp section */
background: linear-gradient(135deg, #7112a1 0%, #540d77 100%);

/* Avatar gradients (examples) */
background: linear-gradient(135deg, #f5c4a3, #e9803a);  /* Orange */
background: linear-gradient(135deg, #a4efcb, #22c375);  /* Green */
background: linear-gradient(135deg, #c1e0fb, #3a9df2);  /* Blue */
background: linear-gradient(135deg, #f4e3fc, #c775f0);  /* Purple */
background: linear-gradient(135deg, #d495f3, #9117cf);  /* Purple dark */

/* Chart gradient */
background: linear-gradient(to right, var(--wh-blue-20), var(--wh-blue-40));
```

---

## 3. Typography

### 3.1 Font Family

```css
font-family: "Poppins", sans-serif;
```

**Poppins** is a geometric sans-serif typeface with a modern, friendly appearance. Load weights: 300, 400, 500, 600, 700.

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### 3.2 Font Weights

| Weight | Value | CSS | Usage |
|--------|-------|-----|-------|
| Light | 300 | `font-weight: 300` | Rarely used |
| Regular | 400 | `font-weight: 400` | Body text, descriptions |
| Medium | 500 | `font-weight: 500` | Navigation, buttons, names |
| Semibold | 600 | `font-weight: 600` | Card titles, author names |
| Bold | 700 | `font-weight: 700` | Headlines, section titles, stats |

### 3.3 Type Scale

| Element | Size | Weight | Line Height | Letter Spacing | Color |
|---------|------|--------|-------------|----------------|-------|
| **H1 (Hero)** | 48px | 700 | 1.2 | Normal | `--text` |
| **H2 (Section)** | 36px | 700 | 1.4 | Normal | `--text` |
| **H3 (Card Title)** | 16px | 600 | 1.5 | Normal | `--text` |
| **Body Large** | 16px | 400 | 1.6 | Normal | `--subtext` |
| **Body** | 14px | 400 | 1.6 | Normal | `--text` |
| **Body Medium** | 14px | 500 | 1.5 | Normal | `--text` |
| **Caption** | 12px | 400 | 1.5 | Normal | `--subtext` |
| **Small** | 11px | 400 | 1.4 | Normal | `--subtext` |
| **Stats Number** | 48px | 700 | 1.2 | Normal | `--wh-white` |
| **Stats Number (Card)** | 24px | 700 | 1.3 | Normal | `--text` |
| **Quote** | 24px | 500 | 1.5 | Normal | `--text` |
| **Logo** | 24px | 700 | 1.2 | Normal | `--text` |
| **Nav Link** | 14px | 500 | 1.5 | Normal | `--text` |
| **Button** | 14px | 500 | 1.5 | Normal | varies |
| **Link (Explore)** | 14px | 500 | 1.5 | Normal | `--wh-blue-50` |

### 3.4 Typography CSS Examples

```css
/* Hero Headline */
.hero-text h1 {
    font-size: 48px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 20px;
    color: var(--text);
}

/* Section Title */
.section-title {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 16px;
    color: var(--text);
}

/* Section Subtitle / Body Large */
.section-subtitle {
    font-size: 16px;
    font-weight: 400;
    color: var(--subtext);
    margin-bottom: 32px;
    line-height: 1.6;
}

/* Card Title */
.feature-title {
    font-weight: 600;
    margin-bottom: 12px;
}

/* Body Text */
.feature-description {
    font-size: 14px;
    color: var(--subtext);
    line-height: 1.6;
}

/* Caption / Small Text */
.crm-item-email,
.crm-item-time {
    font-size: 12px;
    color: var(--subtext);
}

/* Quote */
.testimonial-quote {
    font-size: 24px;
    font-weight: 500;
    max-width: 800px;
    margin: 0 auto 32px;
    line-height: 1.5;
}

/* Stats */
.why-stat-value {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 8px;
}

/* Navigation */
.nav-link {
    font-size: 14px;
    font-weight: 500;
}
```

### 3.5 Typography Hierarchy Examples

```
HERO SECTION:
├── H1: "Elevate Your Customer Support..." (48px/700)
└── Body: "Connect with customers on Live Chat..." (16px/400, subtext)

FEATURE SECTION:
├── H2: "Streamline Your Workflow..." (36px/700)
├── Body: "Our CRM simplifies the process..." (16px/400, subtext)
└── CTA: "Learn more →" (14px/500, black)

CARD:
├── Title: "Security first" (16px/600)
└── Description: "Advanced encryption..." (14px/400, subtext)

LIST ITEM:
├── Name: "Emma Rosenberg" (14px/500)
├── Detail: "Conversation #42" (12px/400, subtext)
└── Time: "2 weeks ago" (12px/400, subtext)
```

---

## 4. Spacing System

### 4.1 Base Unit

The spacing system uses a **4px base unit** with common multiples.

### 4.2 Spacing Scale

| Token | Value | Tailwind Equivalent | Usage |
|-------|-------|---------------------|-------|
| `space-1` | 4px | `p-1`, `m-1` | Icon gaps, tight spacing |
| `space-2` | 8px | `p-2`, `m-2` | Small gaps, list item spacing |
| `space-3` | 12px | `p-3`, `m-3` | Component internal padding |
| `space-4` | 16px | `p-4`, `m-4` | Standard gap, section margins |
| `space-5` | 20px | `p-5`, `m-5` | Card internal padding |
| `space-6` | 24px | `p-6`, `m-6` | Container padding, card padding |
| `space-8` | 32px | `p-8`, `m-8` | Section title margins |
| `space-10` | 40px | `p-10`, `m-10` | Navbar padding, section gaps |
| `space-12` | 48px | `p-12`, `m-12` | Industry section margins |
| `space-15` | 60px | `p-15`, `m-15` | Section padding, content gaps |
| `space-20` | 80px | `p-20`, `m-20` | Major section padding |

### 4.3 Common Spacing Patterns

```css
/* Container */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;  /* 24px horizontal padding */
}

/* Navbar */
.navbar {
    height: 80px;  /* --navbar-height */
    padding: 0 40px;
}

/* Section Vertical Padding */
.section {
    padding: 80px 0;  /* Standard section */
}

.testimonial-section {
    padding: 60px 0;  /* Smaller section */
}

/* Content Grid Gaps */
.hero-content,
.crm-content,
.inbox-content {
    gap: 60px;  /* Two-column layout gap */
}

.features-grid,
.industry-cards {
    gap: 24px;  /* Card grid gap */
}

.analytics-visual {
    gap: 20px;  /* Smaller card gap */
}

/* Component Internal Spacing */
.feature-card {
    padding: 32px;
}

.analytics-card {
    padding: 20px;
}

.crm-section {
    padding: 60px;
    margin: 40px 0;
}

/* Element Margins */
.section-title { margin-bottom: 16px; }
.section-subtitle { margin-bottom: 32px; }
.feature-icon { margin-bottom: 20px; }
.feature-title { margin-bottom: 12px; }
```

### 4.4 Gap Reference

| Context | Gap Value |
|---------|-----------|
| Navigation links | 32px |
| Nav actions | 16px |
| Form elements | 12px |
| CTA buttons | 16px |
| Integration logos | 16px |
| Channel icons | 8px |
| Footer columns | 40px |
| Chatbot cards | 16px |
| Why stats | 40px |

---

## 5. Component Styles

### 5.1 Buttons

#### Primary Button
```css
.btn-primary {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    background: var(--wh-blue-50);  /* #0f82e6 */
    color: var(--wh-white);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary:hover {
    background: var(--wh-blue-60);  /* #0d77d3 */
}
```

#### Black Button
```css
.btn-black {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    background: var(--wh-black);
    color: var(--wh-white);
    border: none;
}

.btn-black:hover {
    background: var(--wh-neutral-90);  /* #1c1c1c */
}
```

#### Outline Button
```css
.btn-outline {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    background: transparent;
    border: 1px solid var(--wh-black);
    color: var(--wh-black);
}

.btn-outline:hover {
    background: rgba(0, 0, 0, 0.04);
}
```

#### Text Button
```css
.btn-text {
    padding: 10px 20px;
    background: transparent;
    color: var(--text);
    border: none;
}
```

#### Learn More Link Button
```css
.learn-more {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--wh-black);
    border: 1px solid var(--wh-black);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
}
```

### 5.2 Cards

#### Feature Card
```css
.feature-card {
    background: var(--wh-white);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
```

#### Industry Card
```css
.industry-card {
    background: var(--wh-white);
    border-radius: 16px;
    padding: 32px 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    text-align: center;
}
```

#### Analytics Card
```css
.analytics-card {
    background: var(--wh-white);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
```

#### Chatbot Card
```css
.chatbot-card {
    background: var(--wh-white);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    text-align: center;
}
```

#### Floating Card
```css
.floating-card {
    position: absolute;
    background: var(--wh-white);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    font-size: 12px;
}
```

### 5.3 Form Elements

#### Input Field
```css
.hero-form input {
    flex: 1;
    padding: 14px 16px;
    border: 1px solid var(--wh-neutral-30);  /* #dbdbdb */
    border-radius: 8px;
    font-size: 14px;
    background: var(--wh-white);
    font-family: "Poppins", sans-serif;
}

.hero-form input::placeholder {
    color: var(--wh-steel-70);  /* #555f68 */
}
```

### 5.4 Navigation

#### Navbar
```css
.navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: var(--main);
    z-index: 1000;
    display: flex;
    align-items: center;
    padding: 0 40px;
}
```

#### Nav Link
```css
.nav-link {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 4px;
}
```

#### Navigation Arrow Button
```css
.nav-arrow {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--wh-white);
    border: 1px solid var(--wh-neutral-20);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
```

### 5.5 Avatars

#### Standard Avatar
```css
.crm-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--wh-purple-20);
}
```

#### Large Avatar
```css
.inbox-avatar,
.testimonial-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f5c4a3, #e9803a);
}
```

### 5.6 Chat Bubbles

```css
.chat-bubble {
    max-width: 80%;
    padding: 12px 16px;
    border-radius: 16px;
    margin-bottom: 12px;
    font-size: 14px;
}

.chat-bubble.received {
    background: var(--wh-neutral-5);  /* #f5f5f5 */
    border-bottom-left-radius: 4px;
}

.chat-bubble.sent {
    background: var(--wh-blue-50);  /* #0f82e6 */
    color: var(--wh-white);
    margin-left: auto;
    border-bottom-right-radius: 4px;
}
```

### 5.7 Status Indicators

```css
.status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
}

.status-dot.green { background: var(--wh-green-40); }  /* #1fad68 */
.status-dot.yellow { background: var(--wh-yellow-40); }  /* #ce8b0d */
```

### 5.8 Icon Containers

```css
/* Feature Icon */
.feature-icon {
    width: 48px;
    height: 48px;
    background: var(--wh-blue-10);
    border-radius: 12px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Industry Icon */
.industry-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    background: var(--wh-purple-5);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
}

/* Chatbot Icon */
.chatbot-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 12px;
    background: var(--wh-purple-10);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Channel Icon */
.channel-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
}

/* Communication Option Icon */
.comm-option-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

### 5.9 Section Containers

#### Purple Section (CRM)
```css
.crm-section {
    background: var(--wh-purple-0);  /* #f9f1fd */
    border-radius: 24px;
    padding: 60px;
    margin: 40px 0;
}
```

#### Green Section (Integrations)
```css
.integrations-section {
    background: var(--wh-green-0);  /* #e5faf0 */
    border-radius: 24px;
    padding: 60px;
    margin: 40px 0;
}
```

#### Neutral Section (Testimonial, CTA)
```css
.testimonial-section,
.cta-section {
    background: var(--wh-neutral-5);  /* #f5f5f5 */
    padding: 60px 0;  /* or 80px 0 for CTA */
    text-align: center;
}
```

#### Gradient Section (Why Whelp)
```css
.why-section {
    background: linear-gradient(135deg, #7112a1 0%, #540d77 100%);
    padding: 80px 0;
    color: var(--wh-white);
}
```

### 5.10 List Items

```css
.crm-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--wh-neutral-20);
}

.crm-item:last-child {
    border-bottom: none;
}
```

### 5.11 Communication Options

```css
.comm-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--wh-neutral-20);
    border-radius: 8px;
    margin-bottom: 12px;
}

/* Selected/Active state */
.comm-option.active {
    border-color: var(--wh-green-40);
}
```

---

## 6. Shadows and Elevation

### 6.1 Shadow Scale

| Level | Value | Usage |
|-------|-------|-------|
| **Level 1 (Subtle)** | `0 2px 10px rgba(0,0,0,0.1)` | Integration logos |
| **Level 2 (Card)** | `0 4px 20px rgba(0,0,0,0.05)` | Feature cards, analytics cards |
| **Level 3 (Elevated)** | `0 4px 20px rgba(0,0,0,0.1)` | Floating cards, badges |
| **Level 4 (Modal)** | `0 4px 30px rgba(0,0,0,0.08)` | Chat panels, visual cards |

### 6.2 Shadow Definitions

```css
/* Subtle shadow - logos, small elements */
box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

/* Standard card shadow */
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);

/* Floating elements */
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

/* Elevated panels */
box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
```

### 6.3 Shadow Usage Guide

```css
/* Cards on cream background */
.feature-card,
.industry-card,
.analytics-card,
.chatbot-card {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

/* Floating UI elements */
.floating-card,
.hero-badge {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* Visual demonstration panels */
.inbox-visual,
.communication-visual {
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
}

/* Small icons/logos */
.integration-logo {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
```

---

## 7. Animations and Transitions

### 7.1 Standard Transition

```css
transition: all 0.2s;
/* or more specific */
transition: all 0.2s ease;
```

### 7.2 Transition Applications

```css
/* Buttons */
.btn {
    transition: all 0.2s;
}

/* Links */
.footer-column a {
    transition: color 0.2s;
}

.footer-column a:hover {
    color: var(--text);
}
```

### 7.3 Hover States

| Element | Property | From | To |
|---------|----------|------|-----|
| Primary Button | `background` | `--wh-blue-50` | `--wh-blue-60` |
| Black Button | `background` | `--wh-black` | `--wh-neutral-90` |
| Outline Button | `background` | `transparent` | `rgba(0,0,0,0.04)` |
| Footer Links | `color` | `--subtext` | `--text` |

### 7.4 Background Effects

```css
/* Hero blob - blurred gradient background */
.hero-blob {
    position: absolute;
    width: 400px;
    height: 400px;
    background: linear-gradient(135deg, var(--wh-purple-10) 0%, var(--wh-orange-10) 100%);
    border-radius: 50%;
    filter: blur(60px);
    z-index: -1;
}
```

### 7.5 Recommended Additional Animations

```css
/* Card hover lift */
.feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
}

/* Button scale on active */
.btn:active {
    transform: scale(0.98);
}

/* Fade in animation */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
    animation: fadeIn 0.5s ease forwards;
}
```

---

## 8. Border Radius

### 8.1 Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Chat bubble corners (exception) |
| `radius-md` | 6px | Channel icons |
| `radius-base` | 8px | Buttons, inputs, small cards |
| `radius-lg` | 12px | Floating cards, chatbot cards, icons |
| `radius-xl` | 16px | Standard cards, chat bubbles |
| `radius-2xl` | 20px | Hero images |
| `radius-3xl` | 24px | Section containers |
| `radius-full` | 50% | Avatars, status dots, nav arrows |

### 8.2 Border Radius Usage

```css
/* Buttons & Inputs */
.btn,
.hero-form input { border-radius: 8px; }

/* Icons */
.channel-icon { border-radius: 6px; }
.comm-option-icon { border-radius: 8px; }
.feature-icon,
.chatbot-icon,
.integration-logo { border-radius: 12px; }
.industry-icon { border-radius: 16px; }

/* Cards */
.chatbot-card { border-radius: 12px; }
.floating-card { border-radius: 12px; }
.feature-card,
.industry-card,
.analytics-card,
.inbox-visual,
.crm-visual { border-radius: 16px; }

/* Hero elements */
.hero-person { border-radius: 20px; }

/* Section containers */
.crm-section,
.integrations-section { border-radius: 24px; }

/* Circular elements */
.crm-avatar,
.inbox-avatar,
.testimonial-avatar,
.status-dot,
.nav-arrow,
.hero-blob { border-radius: 50%; }

/* Chat bubbles */
.chat-bubble { border-radius: 16px; }
.chat-bubble.received { border-bottom-left-radius: 4px; }
.chat-bubble.sent { border-bottom-right-radius: 4px; }
```

---

## 9. Opacity and Transparency

### 9.1 Opacity Values

| Value | Usage |
|-------|-------|
| `1` (100%) | Default, all solid elements |
| `0.8` (80%) | Stats label text on dark background |
| `0.1` (10%) | Shadow opacity (standard) |
| `0.08` (8%) | Shadow opacity (elevated) |
| `0.05` (5%) | Shadow opacity (subtle cards) |
| `0.04` (4%) | Button hover overlay |

### 9.2 RGBA Usage

```css
/* Shadows */
rgba(0, 0, 0, 0.05)  /* Subtle card shadow */
rgba(0, 0, 0, 0.08)  /* Elevated panel shadow */
rgba(0, 0, 0, 0.1)   /* Floating element shadow */

/* Hover overlays */
rgba(0, 0, 0, 0.04)  /* Light hover on outline buttons */

/* Text on dark backgrounds */
.why-stat-label {
    font-size: 14px;
    opacity: 0.8;  /* 80% opacity for muted text */
}
```

### 9.3 Blur Effects

```css
/* Background blur for hero blob */
.hero-blob {
    filter: blur(60px);
}
```

---

## 10. Layout System

### 10.1 Container

```css
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
}

/* Navbar uses wider container */
.navbar-content {
    max-width: 1400px;
    margin: 0 auto;
}
```

### 10.2 Grid Layouts

#### Two-Column (50/50)
```css
.hero-content,
.crm-content,
.inbox-content,
.analytics-content,
.communication-content,
.chatbot-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
}
```

#### Three-Column Grid
```css
.features-grid,
.why-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;  /* or 40px for stats */
}

.chatbot-visual {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}
```

#### Four-Column Grid
```css
.industry-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
}
```

#### Two-Column (Analytics)
```css
.analytics-visual {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}
```

#### Footer Grid
```css
.footer-content {
    display: grid;
    grid-template-columns: 2fr repeat(4, 1fr);
    gap: 40px;
}
```

### 10.3 Flexbox Layouts

#### Horizontal Navigation
```css
.nav-links {
    display: flex;
    align-items: center;
    gap: 32px;
}

.nav-actions {
    display: flex;
    align-items: center;
    gap: 16px;
}
```

#### Form Layout
```css
.hero-form {
    display: flex;
    gap: 12px;
    max-width: 400px;
}
```

#### CTA Buttons
```css
.cta-buttons {
    display: flex;
    justify-content: center;
    gap: 16px;
}
```

#### List Items
```css
.crm-item {
    display: flex;
    align-items: center;
    gap: 12px;
}
```

### 10.4 Fixed Positioning

```css
/* Fixed navbar */
.navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
}

/* Absolute positioned floating cards */
.floating-card {
    position: absolute;
}

.floating-card.top-right { top: 20px; right: 20px; }
.floating-card.bottom-right { bottom: 40px; right: 20px; }
.floating-card.bottom-left { bottom: 20px; left: 20px; }
```

---

## 11. Iconography

### 11.1 Icon Sizes

| Size | Dimensions | Usage |
|------|------------|-------|
| XS | 16px | Dropdown chevrons |
| SM | 24px | Channel icons, logo icon |
| MD | 32px | Communication option icons, logo |
| LG | 48px | Feature icons, chatbot icons, avatars |
| XL | 80px | Industry icons |

### 11.2 Icon Container Backgrounds

```css
/* Blue tint */
.feature-icon,
.chatbot-icon.blue {
    background: var(--wh-blue-10);
}

/* Green tint */
.comm-option-icon.whatsapp,
.channel-icon.chat {
    background: var(--wh-green-10);
    color: var(--wh-green-50);
}

/* Purple tint */
.chatbot-icon,
.industry-icon,
.channel-icon.email {
    background: var(--wh-purple-10);
    /* or --wh-purple-5 for larger icons */
}

/* Orange tint */
.chatbot-icon.orange {
    background: var(--wh-orange-10);
}

/* Blue tint (SMS) */
.comm-option-icon.sms,
.channel-icon.phone {
    background: var(--wh-blue-10);
    color: var(--wh-blue-50);
}
```

### 11.3 SVG Icon Style

```css
/* Navigation dropdown icon */
.nav-link svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
}

/* Logo icon */
.logo-icon {
    width: 32px;
    height: 32px;
}
```

---

## 12. Common Tailwind CSS Usage

If converting to Tailwind CSS, here are the equivalent classes:

### 12.1 Colors

```html
<!-- Backgrounds -->
<div class="bg-[#fefbf6]">Main background</div>
<div class="bg-white">Card background</div>
<div class="bg-[#f5f5f5]">Section background</div>
<div class="bg-[#f9f1fd]">Purple section</div>
<div class="bg-[#e5faf0]">Green section</div>

<!-- Text -->
<p class="text-black">Primary text</p>
<p class="text-[#555f68]">Secondary text</p>
<a class="text-[#0f82e6]">Link text</a>

<!-- Buttons -->
<button class="bg-[#0f82e6] hover:bg-[#0d77d3] text-white">Primary</button>
<button class="bg-black hover:bg-[#1c1c1c] text-white">Black</button>
<button class="bg-transparent border border-black hover:bg-black/[0.04]">Outline</button>
```

### 12.2 Typography

```html
<!-- Headlines -->
<h1 class="text-5xl font-bold leading-tight">Hero H1</h1>
<h2 class="text-4xl font-bold">Section H2</h2>

<!-- Body -->
<p class="text-base text-[#555f68] leading-relaxed">Body text</p>
<p class="text-sm font-medium">Medium body</p>
<span class="text-xs text-[#555f68]">Caption</span>

<!-- Stats -->
<span class="text-5xl font-bold text-white">48px stat</span>
<span class="text-2xl font-bold">24px stat</span>
```

### 12.3 Spacing

```html
<!-- Container -->
<div class="max-w-[1200px] mx-auto px-6">Container</div>

<!-- Sections -->
<section class="py-20">Standard section</section>
<section class="py-16">Smaller section</section>

<!-- Cards -->
<div class="p-8">Feature card padding</div>
<div class="p-5">Analytics card padding</div>
<div class="p-4">Small card padding</div>

<!-- Gaps -->
<div class="gap-6">24px gap</div>
<div class="gap-4">16px gap</div>
<div class="gap-3">12px gap</div>
<div class="gap-2">8px gap</div>
```

### 12.4 Border Radius

```html
<button class="rounded-lg">8px radius</button>
<div class="rounded-xl">12px radius</div>
<div class="rounded-2xl">16px radius</div>
<div class="rounded-3xl">24px radius</div>
<div class="rounded-full">Circular</div>
```

### 12.5 Shadows

```html
<div class="shadow-[0_4px_20px_rgba(0,0,0,0.05)]">Card shadow</div>
<div class="shadow-[0_4px_20px_rgba(0,0,0,0.1)]">Floating shadow</div>
<div class="shadow-[0_4px_30px_rgba(0,0,0,0.08)]">Elevated shadow</div>
```

### 12.6 Flexbox & Grid

```html
<!-- Flex -->
<div class="flex items-center gap-8">Nav links</div>
<div class="flex items-center gap-4">Nav actions</div>
<div class="flex items-center gap-3">List item</div>
<div class="flex justify-center gap-4">CTA buttons</div>

<!-- Grid -->
<div class="grid grid-cols-2 gap-16 items-center">Two column</div>
<div class="grid grid-cols-3 gap-6">Three column</div>
<div class="grid grid-cols-4 gap-6">Four column</div>
```

### 12.7 Layout

```html
<!-- Fixed navbar -->
<nav class="fixed top-0 left-0 right-0 h-20 z-[1000]">Navbar</nav>

<!-- Absolute positioning -->
<div class="absolute top-5 right-5">Top right</div>
<div class="absolute bottom-10 right-5">Bottom right</div>
<div class="absolute bottom-5 left-5">Bottom left</div>
```

### 12.8 Custom Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'wh-main': '#fefbf6',
        'wh-footer': '#f5f4ef',
        'wh-blue': {
          10: '#c1e0fb',
          50: '#0f82e6',
          60: '#0d77d3',
        },
        'wh-green': {
          0: '#e5faf0',
          10: '#a4efcb',
          40: '#1fad68',
          50: '#1b985b',
        },
        'wh-purple': {
          0: '#f9f1fd',
          5: '#f4e3fc',
          10: '#ecd1fa',
          80: '#7112a1',
          90: '#540d77',
        },
        'wh-steel': {
          70: '#555f68',
        },
        'wh-neutral': {
          5: '#f5f5f5',
          20: '#ebebeb',
          30: '#dbdbdb',
          90: '#1c1c1c',
        },
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
      },
      fontSize: {
        'hero': ['48px', { lineHeight: '1.2', fontWeight: '700' }],
        'section': ['36px', { lineHeight: '1.4', fontWeight: '700' }],
        'quote': ['24px', { lineHeight: '1.5', fontWeight: '500' }],
        'stat': ['48px', { lineHeight: '1.2', fontWeight: '700' }],
      },
      spacing: {
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },
      borderRadius: {
        '4xl': '24px',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'floating': '0 4px 20px rgba(0, 0, 0, 0.1)',
        'elevated': '0 4px 30px rgba(0, 0, 0, 0.08)',
        'subtle': '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
    },
  },
}
```

---

## 13. Example Component Reference Code

### 13.1 Feature Card Component

```html
<!-- HTML -->
<div class="feature-card">
    <div class="feature-icon">
        <svg><!-- icon --></svg>
    </div>
    <h3 class="feature-title">Security first</h3>
    <p class="feature-description">
        Advanced encryption and security measures protect customer data
        across all channels, ensuring compliance and peace of mind.
    </p>
</div>

<style>
.feature-card {
    background: var(--wh-white);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.feature-icon {
    width: 48px;
    height: 48px;
    background: var(--wh-blue-10);
    border-radius: 12px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.feature-title {
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text);
}

.feature-description {
    font-size: 14px;
    color: var(--subtext);
    line-height: 1.6;
}
</style>
```

### 13.2 Button Component

```html
<!-- Primary Button -->
<button class="btn btn-primary">Get Started</button>

<!-- Outline Button -->
<button class="btn btn-outline">View pricing</button>

<!-- Learn More Link -->
<a href="#" class="learn-more">
    Learn more
    <span class="arrow-icon">→</span>
</a>

<style>
.btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    font-family: "Poppins", sans-serif;
}

.btn-primary {
    background: var(--wh-blue-50);
    color: var(--wh-white);
}

.btn-primary:hover {
    background: var(--wh-blue-60);
}

.btn-outline {
    background: transparent;
    border: 1px solid var(--wh-black);
    color: var(--wh-black);
}

.btn-outline:hover {
    background: rgba(0, 0, 0, 0.04);
}

.learn-more {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--wh-black);
    border: 1px solid var(--wh-black);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    text-decoration: none;
}
</style>
```

### 13.3 Chat Interface Component

```html
<div class="chat-container">
    <div class="chat-header">
        <div class="chat-avatar"></div>
        <div class="chat-user-info">
            <div class="chat-name">John Brown</div>
            <div class="chat-status">Online</div>
        </div>
    </div>
    <div class="chat-messages">
        <div class="chat-bubble received">
            Hi! I sent a message from your site couple days ago
        </div>
        <div class="chat-bubble received">
            Can you check all your emails and review the status?
        </div>
        <div class="chat-bubble sent">
            You can check all your orders in your personal cabinet, thanks!
        </div>
    </div>
</div>

<style>
.chat-container {
    background: var(--wh-white);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
}

.chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--wh-neutral-20);
    margin-bottom: 16px;
}

.chat-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f5c4a3, #e9803a);
}

.chat-name {
    font-weight: 600;
}

.chat-status {
    font-size: 12px;
    color: var(--wh-green-50);
}

.chat-bubble {
    max-width: 80%;
    padding: 12px 16px;
    border-radius: 16px;
    margin-bottom: 12px;
    font-size: 14px;
}

.chat-bubble.received {
    background: var(--wh-neutral-5);
    border-bottom-left-radius: 4px;
}

.chat-bubble.sent {
    background: var(--wh-blue-50);
    color: var(--wh-white);
    margin-left: auto;
    border-bottom-right-radius: 4px;
}
</style>
```

### 13.4 Stats Section Component

```html
<section class="stats-section">
    <div class="container">
        <h2 class="stats-title">Why Whelp?</h2>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">68%</div>
                <div class="stat-label">Automation for businesses at least</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">2.7%</div>
                <div class="stat-label">Increase in usage of WhatsApp</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">4M+</div>
                <div class="stat-label">Conversations have been powered</div>
            </div>
        </div>
    </div>
</section>

<style>
.stats-section {
    background: linear-gradient(135deg, #7112a1 0%, #540d77 100%);
    padding: 80px 0;
    color: var(--wh-white);
}

.stats-title {
    text-align: center;
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 60px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 40px;
    text-align: center;
}

.stat-value {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 8px;
}

.stat-label {
    font-size: 14px;
    opacity: 0.8;
}
</style>
```

### 13.5 Floating Card Component

```html
<div class="floating-card">
    <div class="floating-card-header">
        <span class="status-dot green"></span>
        <span>Try Omnichannel</span>
    </div>
    <div class="channel-icons">
        <span class="channel-icon phone">📞</span>
        <span class="channel-icon email">✉</span>
        <span class="channel-icon chat">💬</span>
    </div>
</div>

<style>
.floating-card {
    position: absolute;
    background: var(--wh-white);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    font-size: 12px;
}

.floating-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.status-dot.green {
    background: var(--wh-green-40);
}

.channel-icons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.channel-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
}

.channel-icon.phone {
    background: var(--wh-blue-10);
    color: var(--wh-blue-50);
}

.channel-icon.email {
    background: var(--wh-purple-10);
    color: var(--wh-purple-50);
}

.channel-icon.chat {
    background: var(--wh-green-10);
    color: var(--wh-green-50);
}
</style>
```

---

## 14. Accessibility Guidelines

### 14.1 Color Contrast

- Primary text on main background: `#000000` on `#fefbf6` = **15.5:1** (AAA)
- Secondary text on main background: `#555f68` on `#fefbf6` = **6.8:1** (AAA)
- White text on blue button: `#ffffff` on `#0f82e6` = **4.6:1** (AA)
- White text on purple gradient: `#ffffff` on `#7112a1` = **8.2:1** (AAA)

### 14.2 Focus States

```css
/* Add visible focus states for keyboard navigation */
.btn:focus,
.nav-link:focus,
.learn-more:focus {
    outline: 2px solid var(--wh-blue-50);
    outline-offset: 2px;
}

.hero-form input:focus {
    outline: none;
    border-color: var(--wh-blue-50);
    box-shadow: 0 0 0 3px rgba(15, 130, 230, 0.2);
}
```

### 14.3 Semantic HTML

- Use proper heading hierarchy (h1 → h2 → h3)
- Use `<nav>` for navigation
- Use `<main>` for main content
- Use `<section>` with `aria-label` for distinct sections
- Use `<footer>` for footer content
- Use `<button>` for interactive elements

### 14.4 ARIA Attributes

```html
<nav aria-label="Main navigation">
<section aria-labelledby="features-heading">
<button aria-expanded="false" aria-controls="dropdown-menu">
```

---

## 15. Responsive Design

### 15.1 Breakpoints

```css
/* Mobile first approach */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### 15.2 Responsive Patterns

```css
/* Stack columns on mobile */
@media (max-width: 1023px) {
    .hero-content,
    .crm-content,
    .inbox-content,
    .analytics-content {
        grid-template-columns: 1fr;
        gap: 40px;
    }

    .features-grid {
        grid-template-columns: 1fr;
    }

    .industry-cards {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 767px) {
    .navbar {
        height: var(--navbar-height-sm);  /* 64px */
        padding: 0 16px;
    }

    .hero-text h1 {
        font-size: 32px;
    }

    .section-title {
        font-size: 28px;
    }

    .industry-cards {
        grid-template-columns: 1fr;
    }

    .footer-content {
        grid-template-columns: 1fr;
    }
}
```

### 15.3 Navbar Height Variables

```css
:root {
    --navbar-height: 80px;     /* Desktop */
    --navbar-height-sm: 64px;  /* Mobile */
}
```

---

## Appendix: Quick Reference

### Color Quick Reference
| Purpose | Variable | Hex |
|---------|----------|-----|
| Background | `--main` | #fefbf6 |
| Card | `--wh-white` | #ffffff |
| Text | `--text` | #000000 |
| Muted | `--subtext` | #555f68 |
| Primary | `--wh-blue-50` | #0f82e6 |
| Success | `--wh-green-50` | #1b985b |
| Border | `--wh-neutral-20` | #ebebeb |

### Spacing Quick Reference
| Size | Value |
|------|-------|
| XS | 4px |
| SM | 8px |
| MD | 12px |
| Base | 16px |
| LG | 24px |
| XL | 32px |
| 2XL | 40px |
| 3XL | 60px |
| 4XL | 80px |

### Border Radius Quick Reference
| Size | Value |
|------|-------|
| SM | 6-8px |
| MD | 12px |
| LG | 16px |
| XL | 20px |
| 2XL | 24px |
| Full | 50% |

---

*Last updated: December 2024*
*Version: 1.0*
