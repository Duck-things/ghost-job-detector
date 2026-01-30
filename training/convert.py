# convert.py - convert to tensorflow.js
# run: python convert.py

import os
import tensorflowjs as tfjs
from tensorflow import keras

MODEL_PATH = 'trained_model/model.keras'
OUTPUT_DIR = 'tfjs_model'

if not os.path.exists(MODEL_PATH):
    alt = 'trained_model/model.h5'
    if os.path.exists(alt):
        MODEL_PATH = alt
    else:
        print('ERROR: Model not found. Run train.py first.')
        exit(1)

print('Loading...')
model = keras.models.load_model(MODEL_PATH)

print('Converting...')
os.makedirs(OUTPUT_DIR, exist_ok=True)
tfjs.converters.save_keras_model(model, OUTPUT_DIR)

print(f'\nDone! Files:')
for f in sorted(os.listdir(OUTPUT_DIR)):
    sz = os.path.getsize(os.path.join(OUTPUT_DIR, f))
    print(f'  {f} ({sz:,} bytes)')

total = sum(os.path.getsize(os.path.join(OUTPUT_DIR, f)) for f in os.listdir(OUTPUT_DIR))
print(f'\nTotal: {total:,} bytes ({total/1024:.1f} KB)')
print('\nUpload tfjs_model folder to web hosting.')
