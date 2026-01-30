# Training Your Own Ghost Job Detection Model

Step-by-step guide to training a machine learning model that can detect ghost/fake job listings.

## Table of Contents

1. [What Youll Need](#what-youll-need)
2. [Setting Up](#setting-up)
3. [Collecting Training Data](#collecting-training-data)
4. [Labeling Your Data](#labeling-your-data)
5. [Training the Model](#training-the-model)
6. [Testing](#testing)
7. [Converting for Browser](#converting-for-browser)
8. [Hosting Your Model](#hosting-your-model)
9. [Using With the Script](#using-with-the-script)
10. [Troubleshooting](#troubleshooting)

---

## What Youll Need

**Hardware:**
- Computer with 8GB+ RAM
- GPU optional but speeds things up

**Software:**
- Python 3.8+
- About 1GB disk space

**Data:**
- 200+ ghost job listings (jobs you applied to that ghosted you or were obviously fake)
- 200+ real job listings (jobs that responded, had real interviews, etc)
- More data = better results

**Time:**
- Setup: 30 min
- Data collection: few hours to a week depending on how much you have
- Training: 15-60 min

---

## Setting Up

### Install Python

**Windows:**
1. Download from python.org
2. Run installer
3. CHECK "Add Python to PATH"
4. Install

**Mac:**
```
brew install python
```

**Linux:**
```
sudo apt install python3 python3-pip python3-venv
```

### Create Project Folder

Make a folder somewhere like `ghost-detector-training`

### Open Terminal There

Windows: open folder in explorer, click address bar, type `cmd`, enter
Mac/Linux: `cd ~/ghost-detector-training`

### Create Virtual Environment

```
python -m venv venv
```

### Activate It

Windows:
```
venv\Scripts\activate
```

Mac/Linux:
```
source venv/bin/activate
```

You should see `(venv)` in your prompt now.

### Install Packages

```
pip install tensorflow tensorflowjs pandas numpy scikit-learn
```

---

## Collecting Training Data

The model learns from examples of ghost jobs vs real jobs. You need to collect both.

### What Makes a Ghost Job?

Based on my experience, ghost jobs often have:
- Posted 60+ days ago
- 500+ applicants but still "open"
- No salary listed
- Vague generic description
- Red flag phrases ("fast-paced", "like a family", etc)
- From staffing agencies posting for "confidential clients"
- Entry level but wants 5+ years experience
- Reposted multiple times

### What Makes a Real Job?

Real jobs that actually hired someone usually have:
- Posted recently (last 2 weeks)
- Reasonable applicant count
- Salary listed
- Specific team/manager mentioned
- Detailed job duties
- Clear interview process described

### How to Collect Data

**Option 1: Track Your Own Applications**

Keep a spreadsheet of jobs you apply to. After a few weeks/months, you'll know which ones responded (real) vs which ones ghosted (ghost).

**Option 2: Use the Script's Data**

The advanced script tracks which jobs you whitelist (trusted = probably real) vs blacklist (blocked = probably ghost). Export these lists and use them as training data.

**Option 3: Manual Collection**

Go through job sites and manually identify obvious ghosts vs legitimate postings.

### Data Format

Create a CSV file with these columns:

```
label,age_days,applicants,has_salary,salary_range,text_length,red_flag_count,is_staffing,is_repost,entry_high_exp,for_client,has_benefits,has_manager,competitive_salary
1,95,750,0,0,1200,3,1,1,0,1,0,0,1
0,5,23,1,15000,3500,0,0,0,0,0,1,1,0
```

Where:
- `label`: 1 = ghost, 0 = real
- `age_days`: how old the posting is
- `applicants`: number of applicants
- `has_salary`: 1 if salary listed, 0 if not
- `salary_range`: difference between high and low salary (0 if not listed)
- `text_length`: character count of description
- `red_flag_count`: number of red flag phrases found
- `is_staffing`: 1 if staffing agency
- `is_repost`: 1 if reposted
- `entry_high_exp`: 1 if entry level but wants 5+ years
- `for_client`: 1 if "hiring for client"
- `has_benefits`: 1 if benefits mentioned
- `has_manager`: 1 if hiring manager named
- `competitive_salary`: 1 if uses "competitive" phrase

---

## Labeling Your Data

If you have raw job listing text, use this helper script to extract features:

Save as `extract_features.py`:

```python
import re
import csv
import sys

staffing = ['robert half', 'randstad', 'adecco', 'manpower', 'apex systems', 
            'tek systems', 'insight global', 'cybercoders', 'staffing', 'recruiting']

red_flags = [
    r'fast[- ]?paced',
    r'like a family',
    r'wear many hats',
    r'self[- ]?starter',
    r'unlimited (pto|vacation)',
    r'ground[- ]?floor',
    r'rock\s?star|ninja',
    r'hustle|grind',
    r'urgent(ly)? (hiring|need)'
]

def extract(text, age_days, applicants, label):
    text_lower = text.lower()
    
    # has salary
    has_sal = 1 if re.search(r'\$\s*\d{2,3},?\d{3}', text) else 0
    
    # salary range
    sal_range = 0
    m = re.search(r'\$\s*(\d{2,3}),?(\d{3}).*?\$\s*(\d{2,3}),?(\d{3})', text)
    if m:
        lo = int(m.group(1) + m.group(2))
        hi = int(m.group(3) + m.group(4))
        sal_range = hi - lo
    
    # text length
    text_len = len(text)
    
    # red flags
    rf_count = sum(1 for rf in red_flags if re.search(rf, text_lower))
    
    # staffing
    is_staff = 1 if any(s in text_lower for s in staffing) else 0
    
    # repost
    is_repost = 1 if 'repost' in text_lower else 0
    
    # entry + high exp
    entry_high = 0
    if re.search(r'entry[- ]?level|junior', text_lower):
        yrs = re.search(r'(\d+)\+?\s*years?', text_lower)
        if yrs and int(yrs.group(1)) >= 5:
            entry_high = 1
    
    # for client
    for_client = 1 if re.search(r'hiring for (a )?client|confidential', text_lower) else 0
    
    # has benefits
    has_ben = 1 if re.search(r'401k|health insurance|dental|vision', text_lower) else 0
    
    # has manager
    has_mgr = 1 if re.search(r'hiring manager|reporting to', text_lower) else 0
    
    # competitive
    comp = 1 if re.search(r'competitive (salary|pay)', text_lower) else 0
    
    return [
        label, age_days, applicants, has_sal, sal_range, text_len,
        rf_count, is_staff, is_repost, entry_high, for_client,
        has_ben, has_mgr, comp
    ]

# usage: python extract_features.py input.txt age applicants label
if __name__ == '__main__':
    if len(sys.argv) < 5:
        print('Usage: python extract_features.py input.txt age_days applicants label')
        sys.exit(1)
    
    with open(sys.argv[1], 'r') as f:
        text = f.read()
    
    features = extract(text, int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]))
    print(','.join(map(str, features)))
```

---

## Training the Model

Save as `train.py`:

```python
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping

# ===== CONFIG =====
DATA_FILE = 'training_data.csv'
OUTPUT_DIR = 'trained_model'
EPOCHS = 100
BATCH_SIZE = 32

print('='*50)
print('GHOST JOB DETECTOR TRAINER')
print('='*50)

# load data
if not os.path.exists(DATA_FILE):
    print(f'ERROR: {DATA_FILE} not found!')
    print('Create a CSV with columns: label,age_days,applicants,has_salary,...')
    exit(1)

df = pd.read_csv(DATA_FILE)
print(f'\nLoaded {len(df)} samples')
print(f'Ghost jobs: {len(df[df["label"]==1])}')
print(f'Real jobs: {len(df[df["label"]==0])}')

# separate features and labels
X = df.drop('label', axis=1).values
y = df['label'].values

# normalize features
scaler = StandardScaler()
X = scaler.fit_transform(X)

# save scaler params for later
np.save(os.path.join(OUTPUT_DIR, 'scaler_mean.npy'), scaler.mean_)
np.save(os.path.join(OUTPUT_DIR, 'scaler_scale.npy'), scaler.scale_)

# split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f'\nTraining samples: {len(X_train)}')
print(f'Test samples: {len(X_test)}')

# build model
model = keras.Sequential([
    Dense(64, activation='relu', input_shape=(X.shape[1],)),
    BatchNormalization(),
    Dropout(0.3),
    Dense(32, activation='relu'),
    BatchNormalization(),
    Dropout(0.2),
    Dense(16, activation='relu'),
    Dense(1, activation='sigmoid')
])

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='binary_crossentropy',
    metrics=['accuracy']
)

print(f'\nModel params: {model.count_params():,}')

# train
callbacks = [
    EarlyStopping(monitor='val_accuracy', patience=10, restore_best_weights=True)
]

print('\nTraining...')
history = model.fit(
    X_train, y_train,
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    validation_data=(X_test, y_test),
    callbacks=callbacks,
    verbose=1
)

# evaluate
loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f'\nTest accuracy: {acc*100:.1f}%')

# save
os.makedirs(OUTPUT_DIR, exist_ok=True)
model.save(os.path.join(OUTPUT_DIR, 'model.keras'))
model.save(os.path.join(OUTPUT_DIR, 'model.h5'))

print(f'\nModel saved to {OUTPUT_DIR}/')
print('Next: run python convert.py')
```

### Run Training

```
python train.py
```

---

## Testing

Save as `test.py`:

```python
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import sys
import numpy as np
from tensorflow import keras

MODEL_PATH = 'trained_model/model.keras'

def load_model():
    if not os.path.exists(MODEL_PATH):
        print('ERROR: Model not found. Run train.py first.')
        exit(1)
    return keras.models.load_model(MODEL_PATH)

def predict(features):
    model = load_model()
    
    # load scaler
    mean = np.load('trained_model/scaler_mean.npy')
    scale = np.load('trained_model/scaler_scale.npy')
    
    # normalize
    features = (np.array(features) - mean) / scale
    features = features.reshape(1, -1)
    
    pred = model.predict(features, verbose=0)[0][0]
    
    print(f'Ghost probability: {pred*100:.1f}%')
    if pred >= 0.6:
        print('Verdict: Likely ghost job')
    elif pred <= 0.4:
        print('Verdict: Probably real')
    else:
        print('Verdict: Uncertain')

# usage: python test.py age apps has_sal sal_range text_len rf_count is_staff is_repost entry_high for_client has_ben has_mgr comp
if __name__ == '__main__':
    if len(sys.argv) < 14:
        print('Usage: python test.py age apps has_sal sal_range text_len rf_count is_staff is_repost entry_high for_client has_ben has_mgr comp')
        print('Example: python test.py 90 500 0 0 1500 3 1 1 0 1 0 0 1')
    else:
        features = [float(x) for x in sys.argv[1:14]]
        predict(features)
```

Test it:
```
python test.py 90 750 0 0 1200 3 1 1 0 1 0 0 1
```

---

## Converting for Browser

Save as `convert.py`:

```python
import os
import tensorflowjs as tfjs
from tensorflow import keras

MODEL_PATH = 'trained_model/model.keras'
OUTPUT_DIR = 'tfjs_model'

if not os.path.exists(MODEL_PATH):
    print('ERROR: Model not found')
    exit(1)

print('Loading model...')
model = keras.models.load_model(MODEL_PATH)

print('Converting...')
os.makedirs(OUTPUT_DIR, exist_ok=True)
tfjs.converters.save_keras_model(model, OUTPUT_DIR)

print(f'\nDone! Files in {OUTPUT_DIR}/')
for f in sorted(os.listdir(OUTPUT_DIR)):
    sz = os.path.getsize(os.path.join(OUTPUT_DIR, f))
    print(f'  {f} ({sz:,} bytes)')

print('\nNext: Upload tfjs_model folder to web hosting')
```

Run:
```
python convert.py
```

---

## Hosting Your Model

### GitHub Pages (free)

1. Create new repo on GitHub
2. Upload contents of `tfjs_model` folder
3. Go to Settings > Pages > Enable
4. Your URL: `https://yourusername.github.io/yourrepo/model.json`

### Cloudflare Pages (free)

1. Go to pages.cloudflare.com
2. Connect repo or upload directly
3. Deploy

### Your Own Server

Upload files anywhere. Make sure CORS is enabled:

Nginx:
```
location /model/ {
    add_header Access-Control-Allow-Origin *;
}
```

---

## Using With the Script

1. Install the ML version: `ghost-job-detector-ml.user.js`
2. In the panel, enter your model URL in "Model URL" field
3. Click "Load Model"
4. Should say "Model loaded" in green
5. Make sure "Use ML" is checked
6. Browse jobs - the ML will now contribute to scoring

---

## Troubleshooting

### "No module named tensorflow"
Activate your virtual environment first.

### Model wont load in browser
- Check all files uploaded (model.json + .bin files)
- Check CORS headers
- Check browser console for errors

### Low accuracy
- Need more training data
- Check for mislabeled data
- Make sure both classes are balanced

### Training crashes
- Reduce batch size
- Check for NaN values in data

---

## Feature Reference

The model expects these 12 features in order:

| # | Feature | Description | Range |
|---|---------|-------------|-------|
| 1 | age_days | Days since posted | 0-365+ |
| 2 | applicants | Applicant count | 0-5000+ |
| 3 | has_salary | Salary listed? | 0/1 |
| 4 | salary_range | High - low salary | 0-100000+ |
| 5 | text_length | Description length | 0-10000+ |
| 6 | red_flag_count | Red flag phrases | 0-9 |
| 7 | is_staffing | Staffing agency? | 0/1 |
| 8 | is_repost | Reposted? | 0/1 |
| 9 | entry_high_exp | Entry + 5yr exp? | 0/1 |
| 10 | for_client | "For client"? | 0/1 |
| 11 | has_benefits | Benefits listed? | 0/1 |
| 12 | has_manager | Manager named? | 0/1 |
| 13 | competitive_salary | "Competitive"? | 0/1 |

The browser script automatically extracts these from job cards.
