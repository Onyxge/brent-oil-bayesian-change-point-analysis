# **Foundation for Analysis: Brent Oil Price Change Points**

## **1\. Executive Summary**

This document outlines the analytical framework for detecting structural breaks in Brent oil prices (1987–2022). Preliminary analysis confirms that while raw prices follow a non-stationary trend, market returns exhibit stationarity, validating our choice of sophisticated time-series modeling. The project aims to correlate these statistical "change points" with major geopolitical events.

## **2\. Data Analysis Workflow**

Our pipeline follows a reproducible Data Science workflow:

### **Phase 1: Ingestion & Preprocessing**

* **Data Source:** Historical Brent oil prices (daily).  
* **Cleaning:** Date parsing (handling mixed formats) and chronological sorting.  
* **Transformation:** Derivation of **Log Returns** (rt​=ln(Pt​/Pt−1​)) to normalize volatility and achieve stationarity.

### **Phase 2: Exploratory Data Analysis (EDA)**

We rigorously investigated the time series properties:

* **Trend Analysis:** Visual inspection confirms a stochastic trend with significant volatility clustering (e.g., 2008, 2020).

* **Stationarity Tests:**  
  * **Raw Prices:** Augmented Dickey-Fuller (ADF) statistic of **\-1.99** (p=0.289), indicating the series is **non-stationary**.  
  * **Log Returns:** ADF statistic of **\-16.43** (p=0.000), indicating **stationarity**. This confirms the data is suitable for modeling without further differencing.

### **Phase 3: Bayesian Change Point Modeling (Task 2\)**

We will implement a Probabilistic Model using **PyMC**:

* **Model Architecture:** We assume the data (returns or prices) comes from a distribution whose parameters (mean μ, variance σ) change abruptly at time τ.  
* **Priors:**  
  * τ (Switch Point): Discrete Uniform distribution over the time range.  
  * μ (Mean Price/Return): Normal distributions for pre- and post-change states.  
* **Inference:** Markov Chain Monte Carlo (MCMC) sampling to generate a posterior distribution for τ.

### **Phase 4: Insight & Visualization (Task 3\)**

* **Correlation:** Detected dates will be matched against our "Key Events" dataset (see Section 4).  
* **Dashboarding:** A Flask/React application will visualize these change points, allowing stakeholders to filter by event type (e.g., "Sanctions," "OPEC Policy").

## **3\. Assumptions and Limitations**

### **Assumptions**

* **Structural Breaks:** We assume market shifts occur as discrete steps (structural breaks) rather than purely gradual transitions.  
* **Market Efficiency:** We assume major geopolitical news is priced into the market relatively quickly (within days/weeks), making the "switch point" identifiable near the event date.  
* **Independence:** For the base model, we assume daily observations within a regime are independent (though in reality, volatility clustering exists).

### **Limitations**

* **Univariate Scope:** The model relies solely on price history. It does not account for external variables like inventory levels, USD exchange rates, or production volume explicitly.  
* **Correlation vs. Causation (Crucial):**  
  * **Correlation:** Our model identifies *when* the data structure changed.  
  * **Causation:** We infer causality based on temporal coincidence with historical events. A statistical change point at the time of the Gulf War is *associated* with the war, but the model does not "know" the war caused it.

## **4\. Communication Strategy**

* **Interactive Dashboard:** Primary tool for stakeholders to explore specific date ranges and events.  
* **Technical Report:** A static document detailing the quantified impact (e.g., "Event X caused a volatility increase of Y%").
```
Event_ID,Event_Name,Event_Type,Date,Description,Source
1,First Gulf War,Geopolitical Conflict,1990-08-02,Iraq invades Kuwait causing a major oil supply shock,EIA; BP Statistical Review
2,Asian Financial Crisis,Economic Shock,1997-07-02,Collapse of Asian economies reduced global oil demand,IMF; World Bank
3,OPEC Coordinated Production Cuts,OPEC Policy,1999-03-01,OPEC agreed on coordinated cuts to stabilize oil prices,OPEC Annual Report
4,September 11 Attacks,Geopolitical Shock,2001-09-11,Terrorist attacks increased geopolitical risk premiums in oil markets,EIA; Bloomberg
5,Iraq War,Geopolitical Conflict,2003-03-20,US-led invasion of Iraq disrupted Middle East supply expectations,EIA
6,Global Financial Crisis,Economic Shock,2008-09-15,Severe demand collapse and extreme oil price volatility,IMF; World Bank
7,Arab Spring,Geopolitical Unrest,2011-01-25,Political instability across several oil-producing countries,Brookings Institution; EIA
8,Libyan Civil War,Geopolitical Conflict,2011-02-15,Libya’s oil production dropped sharply due to civil war,EIA
9,Iran Nuclear Sanctions,Sanctions,2012-01-23,International sanctions restricted Iranian oil exports,U.S. Treasury; EIA
10,OPEC Decision to Maintain Output,OPEC Policy,2014-11-27,OPEC chose not to cut production leading to price collapse,OPEC Press Releases
11,Russia–Ukraine Crimea Conflict,Geopolitical Conflict,2014-03-18,Geopolitical tensions increased uncertainty in energy markets,IEA; EIA
12,China Stock Market Crash,Economic Shock,2015-06-12,Slowing Chinese growth reduced global oil demand expectations,IMF
13,OPEC and Non-OPEC Production Cut Agreement,OPEC Policy,2016-11-30,Historic agreement to reduce output and stabilize prices,OPEC
14,US Sanctions on Venezuela,Sanctions,2017-08-25,Sanctions reduced Venezuelan crude oil exports,EIA
15,US Withdrawal from Iran Nuclear Deal,Sanctions,2018-05-08,Reimposed sanctions tightened global oil supply,U.S. State Department; EIA
16,Saudi Aramco Facility Attack,Geopolitical Shock,2019-09-14,Drone attacks temporarily disrupted Saudi oil production,Reuters; EIA
17,OPEC+ Price War,OPEC Policy,2020-03-06,Disagreement between Saudi Arabia and Russia led to price crash,OPEC; IEA
18,COVID-19 Global Lockdowns,Economic Shock,2020-03-11,Pandemic-related lockdowns caused a collapse in oil demand,WHO; IEA
19,OPEC+ Historic Production Cuts,OPEC Policy,2020-04-12,Largest coordinated production cuts in history to stabilize prices,OPEC
20,Post-COVID Global Economic Recovery,Economic Shock,2021-06-01,Reopening economies drove a strong rebound in oil demand,IMF
21,Russia–Ukraine Full-Scale War,Geopolitical Conflict,2022-02-24,War caused major disruptions to global energy markets,IEA; EIA
22,EU Sanctions on Russian Oil,Sanctions,2022-06-03,European Union imposed restrictions on Russian crude imports,European Commission
```