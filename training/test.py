# test.py - test model on features
# run: python test.py 90 500 0 0 1500 3 1 1 0 1 0 0 1

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import sys
import numpy as np
from tensorflow import keras

MODEL_PATH = 'trained_model/model.keras'

def predict(features):
    if not os.path.exists(MODEL_PATH):
        print('ERROR: Model not found')
        exit(1)
    
    model = keras.models.load_model(MODEL_PATH)
    
    mean = np.load('trained_model/scaler_mean.npy')
    scale = np.load('trained_model/scaler_scale.npy')
    
    features = (np.array(features) - mean) / scale
    features = features.reshape(1, -1)
    
    pred = model.predict(features, verbose=0)[0][0]
    
    print(f'Ghost probability: {pred*100:.1f}%')
    if pred >= 0.6:
        print('Verdict: Likely ghost')
    elif pred <= 0.4:
        print('Verdict: Probably real')
    else:
        print('Verdict: Uncertain')

if __name__ == '__main__':
    if len(sys.argv) < 14:
        print('Usage: python test.py age apps has_sal sal_range text_len rf_count is_staff is_repost entry_high for_client has_ben has_mgr comp')
        print('\nExample (ghost-like):')
        print('  python test.py 90 750 0 0 1200 3 1 1 0 1 0 0 1')
        print('\nExample (real-like):')
        print('  python test.py 5 25 1 15000 3500 0 0 0 0 0 1 1 0')
    else:
        features = [float(x) for x in sys.argv[1:14]]
        predict(features)
