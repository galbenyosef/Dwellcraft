'use client';
import { useLanguage, LanguageSwitch } from '@/components/language';
import { HOMES } from '@/lib/world';
import { useState } from 'react';
import { ArrowUpRight, Box, Check, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import Studio from '@/components/studio';
const homes = HOMES;
export default function Home() {
  const { t } = useLanguage();
  const [chosen, setChosen] = useState('home100');
  const [active, setActive] = useState<string | null>(null);
  if (active)
    return (
      <Studio
        key={active}
        home={active as 'home100' | 'home200' | 'estate'}
        onExit={() => setActive(null)}
      />
    );
  return (
    <main className="home-screen">
      <header className="home-header">
        <Link className="brand" href="/">
          <Box size={26} />
          <b>
            Dwellcraft<span>{t('住进想象')}</span>
          </b>
        </Link>
        <span className="edition">YOUR HOME, YOUR WAY.</span>
        <div className="home-header-actions">
          <LanguageSwitch />
          <span className="status-pill">
            <i />
            {t('本机保存 · 无需登录')}
          </span>
        </div>
      </header>
      <section className="home-main">
        <div className="home-heading">
          <div>
            <p className="overline">A SPACE TO MAKE YOUR OWN</p>
            <h1>
              {t('你的下一个家，')}
              <em>{t('由你定义。')}</em>
            </h1>
            <p className="home-subtitle">
              {t('选择一处空间，从第一件家具开始。')}
            </p>
          </div>
          <div className="collection-note">
            <span>01 — 03</span>
            <p>
              {t('三个空间')}
              <br />
              {t('无限种生活方式')}
            </p>
          </div>
        </div>
        <div className="home-grid">
          {homes.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setChosen(h.id)}
              className={'home-card ' + (chosen === h.id ? 'is-picked' : '')}
              aria-pressed={chosen === h.id}
            >
              <div className="home-cover">
                <Image
                  unoptimized
                  width={1600}
                  height={1200}
                  src={'/concepts/' + h.image}
                  alt={t('{name}空间概念', { name: t(h.rooms) })}
                />
                <span className="card-no">0{i + 1}</span>
                <span className="card-check">
                  {chosen === h.id ? (
                    <Check size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <div className="cover-area">
                  <strong>{h.area}</strong>
                  <span>㎡{h.id === 'estate' ? t(' / 总占地') : ''}</span>
                </div>
              </div>
              <div className="home-card-copy">
                <p className="overline">{h.tag}</p>
                <div className="card-title">
                  <h2>{t(h.name)}</h2>
                  <ArrowUpRight size={22} />
                </div>
                <p className="room-label">{t(h.rooms)}</p>
                <p className="card-desc">{t(h.desc)}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="home-bottom">
          <p>{t('从空房开始，或让风格样板间给你一点灵感。')}</p>
          <Button className="enter-button" onClick={() => setActive(chosen)}>
            {t('进入{name}', {
              name: t(homes.find((h) => h.id === chosen)!.name),
            })}
            <MoveRight size={20} />
          </Button>
        </div>
      </section>
      <footer className="home-footer">
        <span>DWELLCRAFT / CREATIVE LIVING</span>
        <span>{t('自由布置 · 真实尺度 · 沉浸漫游')}</span>
      </footer>
    </main>
  );
}
