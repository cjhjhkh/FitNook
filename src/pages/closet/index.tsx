import React, { useState } from 'react';
import './index.less';

const Closet: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'clothes' | 'outfits'>('clothes');
    const [clothesCategory, setClothesCategory] = useState<'shirts' | 'pants' | 'shoes' | 'skirts'>('shirts');

    return (
        <view className="closet-page">
            <view className="top-nav">
                <text
                    className={activeTab === 'clothes' ? 'active' : ''}
                    onClick={() => setActiveTab('clothes')}
                >
                    衣物
                </text>
                <text
                    className={activeTab === 'outfits' ? 'active' : ''}
                    onClick={() => setActiveTab('outfits')}
                >
                    穿搭
                </text>
            </view>

            {activeTab === 'clothes' && (
                <view className="tab-content">
                    <view className="clothes-nav">
                        <text
                            className={clothesCategory === 'shirts' ? 'active' : ''}
                            onClick={() => setClothesCategory('shirts')}
                        >
                            衣服
                        </text>
                        <text
                            className={clothesCategory === 'pants' ? 'active' : ''}
                            onClick={() => setClothesCategory('pants')}
                        >
                            裤子
                        </text>
                        <text
                            className={clothesCategory === 'shoes' ? 'active' : ''}
                            onClick={() => setClothesCategory('shoes')}
                        >
                            鞋
                        </text>
                        <text
                            className={clothesCategory === 'skirts' ? 'active' : ''}
                            onClick={() => setClothesCategory('skirts')}
                        >
                            裙子
                        </text>
                    </view>
                    {clothesCategory === 'shirts' && (
                        <view className="clothes-grid">
                            {Array.from({ length: 20 }, (_, index) => (
                                <view key={index} className="clothes-item">
                                    <view className="clothes-image">shirts图片{index + 1}</view>
                                </view>
                            ))}
                        </view>)}
                    {clothesCategory === 'pants' && (
                        <view className="clothes-grid">
                            {Array.from({ length: 20 }, (_, index) => (
                                <view key={index} className="clothes-item">
                                    <view className="clothes-image">pants图片{index + 1}</view>
                                </view>
                            ))}
                        </view>)}


                    {clothesCategory === 'shoes' && (
                        <view className="clothes-grid">
                            {Array.from({ length: 20 }, (_, index) => (
                                <view key={index} className="clothes-item">
                                    <view className="clothes-image">shoes图片{index + 1}</view>
                                </view>
                            ))}
                        </view>)}
                </view>
            )}

            {activeTab === 'outfits' && (
                <view className="tab-content outfits-grid">
                    {Array.from({ length: 20 }, (_, index) => (
                        <view key={index} className="outfit-item">
                            <view className="outfit-image">👕</view>
                            <view className="outfit-actions">
                            </view>
                        </view>
                    ))}
                    <view className="add-icon">➕</view>
                </view>
            )}
        </view>
    );
};

export default Closet;