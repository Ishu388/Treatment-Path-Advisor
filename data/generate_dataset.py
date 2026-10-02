import pandas as pd
import numpy as np
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

def generate_dataset():
    # 38 symptoms
    symptoms = [
        "Fever", "Cough", "Sore Throat", "Runny Nose", "Sneezing", "Headache",
        "Fatigue", "Body Pain", "Chills", "Nausea", "Vomiting", "Diarrhea",
        "Stomach Pain", "Chest Pain", "Shortness of Breath", "Wheezing",
        "Dizziness", "Loss of Appetite", "Muscle Pain", "Joint Pain",
        "Back Pain", "Abdominal Pain", "Constipation", "Heartburn",
        "Skin Rash", "Itching", "Red Eyes", "Watery Eyes", "Ear Pain",
        "Tooth Pain", "Difficulty Swallowing", "Nasal Congestion",
        "Sweating", "Weakness", "Increased Thirst", "Frequent Urination",
        "Sleep Problems", "Anxiety"
    ]

    # 13 conditions
    conditions = [
        "Common Cold", "Influenza", "Migraine", "Gastroenteritis", "Acid Reflux",
        "Asthma", "Allergy", "Urinary Tract Infection", "Food Poisoning",
        "Tension Headache", "Viral Fever", "Skin Allergy", "General Fatigue"
    ]

    # Typical symptom probabilities for each condition (educational estimation)
    # The probabilities determine how likely a symptom is to be 1 for a given condition
    condition_profiles = {
        "Common Cold": {"Runny Nose": 0.9, "Nasal Congestion": 0.9, "Sneezing": 0.8, "Sore Throat": 0.7, "Cough": 0.6, "Fatigue": 0.4},
        "Influenza": {"Fever": 0.9, "Chills": 0.8, "Body Pain": 0.8, "Fatigue": 0.9, "Cough": 0.7, "Headache": 0.7, "Weakness": 0.8},
        "Migraine": {"Headache": 0.95, "Nausea": 0.6, "Dizziness": 0.4, "Fatigue": 0.5},
        "Gastroenteritis": {"Nausea": 0.8, "Vomiting": 0.8, "Diarrhea": 0.9, "Stomach Pain": 0.8, "Fatigue": 0.6},
        "Acid Reflux": {"Heartburn": 0.9, "Chest Pain": 0.4, "Nausea": 0.3},
        "Asthma": {"Shortness of Breath": 0.9, "Wheezing": 0.9, "Cough": 0.7, "Chest Pain": 0.4},
        "Allergy": {"Sneezing": 0.9, "Runny Nose": 0.8, "Itching": 0.6, "Red Eyes": 0.7, "Watery Eyes": 0.7},
        "Urinary Tract Infection": {"Frequent Urination": 0.9, "Abdominal Pain": 0.5}, # Added basic symptoms for simulation
        "Food Poisoning": {"Nausea": 0.9, "Vomiting": 0.9, "Diarrhea": 0.8, "Stomach Pain": 0.8, "Fever": 0.4, "Weakness": 0.7},
        "Tension Headache": {"Headache": 0.9, "Muscle Pain": 0.4, "Fatigue": 0.4},
        "Viral Fever": {"Fever": 0.95, "Fatigue": 0.8, "Body Pain": 0.7, "Chills": 0.6, "Headache": 0.5, "Weakness": 0.6},
        "Skin Allergy": {"Skin Rash": 0.9, "Itching": 0.9, "Red Eyes": 0.3},
        "General Fatigue": {"Fatigue": 0.9, "Weakness": 0.8, "Sleep Problems": 0.6, "Muscle Pain": 0.4}
    }

    # Generate 120 records per condition
    records_per_condition = 120
    np.random.seed(42)
    random.seed(42)

    data = []

    for condition in conditions:
        profile = condition_profiles.get(condition, {})
        for _ in range(records_per_condition):
            row = {}
            for symptom in symptoms:
                # Base probability is very low (noise)
                prob = profile.get(symptom, 0.05) 
                
                # Introduce some random variation
                val = 1 if random.random() < prob else 0
                row[symptom] = val
            
            # Ensure at least one symptom is selected to avoid empty rows
            if sum(row.values()) == 0:
                # pick a symptom from profile if exists, else random
                if profile:
                    symptom_to_add = random.choice(list(profile.keys()))
                else:
                    symptom_to_add = random.choice(symptoms)
                row[symptom_to_add] = 1

            row['Condition'] = condition
            data.append(row)

    df = pd.DataFrame(data)
    
    # Shuffle dataset
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    dataset_path = BASE_DIR / "data" / "symptom_dataset.csv"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(dataset_path, index=False)
    print(f"Dataset generated successfully at {dataset_path}")

if __name__ == "__main__":
    generate_dataset()
